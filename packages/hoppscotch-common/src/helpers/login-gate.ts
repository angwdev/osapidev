import * as E from "fp-ts/Either"
import { ref } from "vue"
import type { RouteLocationNormalized } from "vue-router"
import { platform } from "~/platform"

/** Routes that stay reachable without signing in: the email sign-in callback and published docs */
const PUBLIC_ROUTE_PREFIXES = ["/enter", "/view"]

const SIGNED_OUT_KEY = "login-gate.signed-out"
const LAST_REDIRECT_KEY = "login-gate.redirected-at"

/**
 * Minimum time between automatic redirects to the identity provider. Stops a
 * redirect loop when sign-in succeeds there but no session comes back.
 */
const REDIRECT_COOLDOWN_MS = 60_000

/** Whether the "sign in to continue" screen is covering the app */
export const isLoginGateActive = ref(false)

/** Whether the app is on its way to the identity provider's sign-in page */
export const isRedirectingToLogin = ref(false)

type LoginRequirement = { requireLogin: boolean; providers: string[] }

let requirement: Promise<LoginRequirement | null> | undefined

const getRequirement = () => {
  requirement ??= (async () => {
    const res = await platform.auth.getLoginRequirement?.()
    // If the backend can't be reached the gate stays open: nothing can be
    // synced then anyway, and the backend itself rejects unauthenticated
    // access to user data.
    return res && E.isRight(res) ? res.right : null
  })()
  return requirement
}

// sessionStorage can be unavailable (privacy modes, sandboxed frames)
const session = {
  get: (key: string) => {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value)
    } catch {
      // ignore
    }
  },
  remove: (key: string) => {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
}

/**
 * Call when the user signs out on purpose. Without it, the gate would send them
 * straight back to the identity provider, which signs them in again silently
 * while its own session lasts.
 */
export const noteExplicitSignOut = () => session.set(SIGNED_OUT_KEY, "1")

const SSO_SIGN_IN: Record<string, () => (() => Promise<unknown>) | undefined> =
  {
    OIDC: () => platform.auth.signInUserWithOIDC,
    GOOGLE: () => platform.auth.signInUserWithGoogle,
    GITHUB: () => platform.auth.signInUserWithGithub,
    MICROSOFT: () => platform.auth.signInUserWithMicrosoft,
  }

/**
 * When single sign-on is the only login method, go straight to it instead of
 * showing a login screen with one button. Web only: on desktop, sign-in opens
 * an external browser, which shouldn't happen unprompted.
 * @returns whether a redirect was started
 */
const tryAutoRedirect = (providers: string[]) => {
  if (!["http:", "https:"].includes(window.location.protocol)) return false
  if (providers.length !== 1) return false

  const signIn = SSO_SIGN_IN[providers[0]]?.()
  if (!signIn) return false
  if (session.get(SIGNED_OUT_KEY)) return false

  const lastRedirect = Number(session.get(LAST_REDIRECT_KEY) ?? 0)
  if (Date.now() - lastRedirect < REDIRECT_COOLDOWN_MS) return false

  session.set(LAST_REDIRECT_KEY, String(Date.now()))
  void signIn.call(platform.auth)
  return true
}

/**
 * Shows the sign-in screen (or starts single sign-on) when the instance
 * requires sign-in, nobody is signed in and the route isn't public.
 */
export const evaluateLoginGate = async (route: RouteLocationNormalized) => {
  const req = await getRequirement()
  const user = platform.auth.getCurrentUser()

  if (user) {
    session.remove(SIGNED_OUT_KEY)
    session.remove(LAST_REDIRECT_KEY)
  }

  if (
    !req?.requireLogin ||
    user ||
    PUBLIC_ROUTE_PREFIXES.some((prefix) => route.path.startsWith(prefix))
  ) {
    isLoginGateActive.value = false
    isRedirectingToLogin.value = false
    return
  }

  isLoginGateActive.value = true
  isRedirectingToLogin.value = tryAutoRedirect(req.providers)
}
