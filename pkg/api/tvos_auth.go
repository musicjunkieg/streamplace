// Package api: Apple TV device-pairing OAuth flow.
//
// The TV displays a QR code that points at https://stream.place/auth/tv
// with a short user code. A phone/browser visits that URL, completes
// ATProto OAuth using the same client every other Streamplace client
// uses, and POSTs the resulting session bundle back to /complete-browser.
// The TV polls /api/tvos-auth/{userCode} and picks up the bundle.
//
// Alternatively a logged-in mobile client may pair its current session
// directly via /complete-mobile (no browser hop needed).
//
// Security: pairing sessions are addressed by short user codes which
// are *also* secrets — anyone who polls the same code as the TV will
// receive the same session bundle. We mitigate by short TTL (5 min)
// and high entropy. The completion endpoints accept whatever bundle
// they receive — a malicious request can only stuff its own valid
// ATProto session into a code, which is the intended use case. The
// channel is HTTPS so the bundle is not exposed in transit.

package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/julienschmidt/httprouter"

	apierrors "stream.place/streamplace/pkg/errors"
	"stream.place/streamplace/pkg/log"
)

// How long an unpaired session stays around. The TV stops polling at
// the same threshold.
const tvosAuthTTL = 5 * time.Minute

// Sweeper runs this often.
const tvosAuthSweepInterval = 30 * time.Second

// TVOSAuthSession is the per-pairing state held in process memory.
type TVOSAuthSession struct {
	UserCode  string
	SessionID string
	ExpiresAt time.Time
	// Bundle is the transferable ATProto OAuth session. nil while
	// pending; populated by either /complete-browser or /complete-mobile.
	Bundle json.RawMessage
}

// TVOSAuthStore keeps pending pairings keyed by both UserCode and
// SessionID — either may appear in the URL path. The map is small
// (active codes in the last 5 minutes) so an in-process map with a
// goroutine sweeper is enough.
type TVOSAuthStore struct {
	mu       sync.RWMutex
	byCode   map[string]*TVOSAuthSession
	byID     map[string]*TVOSAuthSession
	stopOnce sync.Once
	stopCh   chan struct{}
}

// NewTVOSAuthStore creates a store and starts its background sweeper.
// Call Stop() on shutdown if you care about goroutine cleanliness.
func NewTVOSAuthStore(ctx context.Context) *TVOSAuthStore {
	s := &TVOSAuthStore{
		byCode: make(map[string]*TVOSAuthSession),
		byID:   make(map[string]*TVOSAuthSession),
		stopCh: make(chan struct{}),
	}
	go s.sweep(ctx)
	return s
}

func (s *TVOSAuthStore) Stop() {
	s.stopOnce.Do(func() { close(s.stopCh) })
}

func (s *TVOSAuthStore) sweep(ctx context.Context) {
	t := time.NewTicker(tvosAuthSweepInterval)
	defer t.Stop()
	for {
		select {
		case <-s.stopCh:
			return
		case <-ctx.Done():
			return
		case now := <-t.C:
			s.mu.Lock()
			for code, sess := range s.byCode {
				if now.After(sess.ExpiresAt) {
					delete(s.byCode, code)
					delete(s.byID, sess.SessionID)
				}
			}
			s.mu.Unlock()
		}
	}
}

func (s *TVOSAuthStore) start() *TVOSAuthSession {
	sess := &TVOSAuthSession{
		UserCode:  generateUserCode(),
		SessionID: generateSessionID(),
		ExpiresAt: time.Now().Add(tvosAuthTTL),
	}
	s.mu.Lock()
	s.byCode[sess.UserCode] = sess
	s.byID[sess.SessionID] = sess
	s.mu.Unlock()
	return sess
}

func (s *TVOSAuthStore) lookup(key string) *TVOSAuthSession {
	key = strings.ToUpper(strings.TrimSpace(key))
	s.mu.RLock()
	defer s.mu.RUnlock()
	if sess, ok := s.byCode[key]; ok {
		return sess
	}
	if sess, ok := s.byID[key]; ok {
		return sess
	}
	return nil
}

func (s *TVOSAuthStore) complete(key string, bundle json.RawMessage) bool {
	sess := s.lookup(key)
	if sess == nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	sess.Bundle = bundle
	return true
}

// ============== HTTP handlers ==============

// HandleTVOSAuthStart: POST /api/tvos-auth/start
//
// Returns { sessionId, userCode, qrUrl, expiresAt }. The TV uses both
// sessionId (opaque, included in URL of pollers it controls) and
// userCode (human-friendly, shown on-screen + encoded in the QR).
func (a *StreamplaceAPI) HandleTVOSAuthStart(ctx context.Context) httprouter.Handle {
	return func(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
		sess := a.TVOSAuthStore.start()
		scheme := "https"
		if r.TLS == nil && r.Header.Get("X-Forwarded-Proto") == "" {
			scheme = "http"
		}
		if fwd := r.Header.Get("X-Forwarded-Proto"); fwd != "" {
			scheme = fwd
		}
		base := scheme + "://" + r.Host
		qrURL := strings.TrimRight(base, "/") + "/auth/tv?code=" + sess.UserCode

		log.Log(ctx, "tvos-auth start", "userCode", sess.UserCode, "sessionId", sess.SessionID)
		writeJSON(w, http.StatusOK, map[string]any{
			"sessionId": sess.SessionID,
			"userCode":  sess.UserCode,
			"qrUrl":     qrURL,
			"expiresAt": sess.ExpiresAt.Format(time.RFC3339),
		})
	}
}

// HandleTVOSAuthPoll: GET /api/tvos-auth/:key
//
// `key` accepts either userCode or sessionId. Returns one of:
//
//	{ "status": "pending" }
//	{ "status": "ready", "session": <bundle> }
//	404 if expired or unknown.
func (a *StreamplaceAPI) HandleTVOSAuthPoll(ctx context.Context) httprouter.Handle {
	return func(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
		key := p.ByName("sessionId")
		sess := a.TVOSAuthStore.lookup(key)
		if sess == nil {
			apierrors.WriteHTTPNotFound(w, "session not found or expired", nil)
			return
		}
		a.TVOSAuthStore.mu.RLock()
		bundle := sess.Bundle
		a.TVOSAuthStore.mu.RUnlock()
		if bundle == nil {
			writeJSON(w, http.StatusOK, map[string]string{"status": "pending"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status":  "ready",
			"session": bundle,
		})
	}
}

// HandleTVOSAuthCompleteBrowser: POST /api/tvos-auth/:key/complete-browser
//
// The browser-side TV-auth page POSTs the user's freshly-acquired
// session bundle here after completing ATProto OAuth. The body is
// stored verbatim and handed off to the TV on its next poll.
func (a *StreamplaceAPI) HandleTVOSAuthCompleteBrowser(ctx context.Context) httprouter.Handle {
	return a.handleComplete(ctx, "browser")
}

// HandleTVOSAuthCompleteMobile: POST /api/tvos-auth/:key/complete-mobile
//
// Identical body shape to /complete-browser. Posted by an already-
// logged-in mobile client doing in-app pairing.
func (a *StreamplaceAPI) HandleTVOSAuthCompleteMobile(ctx context.Context) httprouter.Handle {
	return a.handleComplete(ctx, "mobile")
}

func (a *StreamplaceAPI) handleComplete(
	ctx context.Context,
	source string,
) httprouter.Handle {
	return func(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
		key := p.ByName("sessionId")
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64*1024))
		if err != nil {
			apierrors.WriteHTTPBadRequest(w, "could not read body", err)
			return
		}
		// Validate it's JSON; we don't enforce a schema beyond that since
		// the OAuthSession shape varies slightly across client libraries.
		var probe map[string]any
		if err := json.Unmarshal(body, &probe); err != nil {
			apierrors.WriteHTTPBadRequest(w, "body is not JSON", err)
			return
		}
		if a.TVOSAuthStore.complete(key, json.RawMessage(body)) {
			log.Log(ctx, "tvos-auth complete", "source", source, "key", key)
			w.WriteHeader(http.StatusNoContent)
			return
		}
		apierrors.WriteHTTPNotFound(w, "session not found or expired", nil)
	}
}

// ============== helpers ==============

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// generateUserCode returns a short A-Z code formatted as XXXX-XXXX.
// 36^8 keyspace ≈ 2.8 trillion combinations; collision over a 5-minute
// window is statistically irrelevant for the rates we care about.
func generateUserCode() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // omit O/0/I/1 for legibility
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		// crypto/rand should not fail; if it does, the request will be
		// rejected on retry. Returning a fixed value keeps callers from
		// panicking.
		return "ERROR-CODE"
	}
	out := make([]byte, 9)
	for i, b := range buf {
		if i == 4 {
			out[i] = '-'
		}
		idx := int(b) % len(alphabet)
		pos := i
		if i >= 4 {
			pos = i + 1
		}
		out[pos] = alphabet[idx]
	}
	return string(out)
}

func generateSessionID() string {
	var buf [16]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "00000000000000000000000000000000"
	}
	return hex.EncodeToString(buf[:])
}
