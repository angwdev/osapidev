import { beforeEach, describe, expect, test, vi } from "vitest"
import * as E from "fp-ts/Either"
import type { RouteLocationNormalized } from "vue-router"

const auth = {
  getLoginRequirement: vi.fn(),
  getCurrentUser: vi.fn(),
  signInUserWithOIDC: vi.fn(),
  signInUserWithGoogle: vi.fn(),
  signInUserWithGithub: vi.fn(),
  signInUserWithMicrosoft: vi.fn(),
}

vi.mock("~/platform", () => ({ platform: { auth } }))

const route = (path: string) => ({ path }) as RouteLocationNormalized

// The helper caches the backend's answer per page load, so load it fresh per test
const loadGate = () => import("~/helpers/login-gate")

const requires = (providers: string[], requireLogin = true) =>
  auth.getLoginRequirement.mockResolvedValue(
    E.right({ requireLogin, providers })
  )

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  sessionStorage.clear()
  auth.getCurrentUser.mockReturnValue(null)
})

describe("evaluateLoginGate", () => {
  test("stays open when the instance doesn't require sign-in", async () => {
    requires(["OIDC"], false)
    const gate = await loadGate()

    await gate.evaluateLoginGate(route("/"))

    expect(gate.isLoginGateActive.value).toBe(false)
    expect(auth.signInUserWithOIDC).not.toHaveBeenCalled()
  })

  test("stays open when the backend can't be reached", async () => {
    auth.getLoginRequirement.mockResolvedValue(E.left("SOMETHING_WENT_WRONG"))
    const gate = await loadGate()

    await gate.evaluateLoginGate(route("/"))

    expect(gate.isLoginGateActive.value).toBe(false)
  })

  test("stays open for a signed-in user", async () => {
    requires(["OIDC"])
    auth.getCurrentUser.mockReturnValue({ uid: "u1" })
    const gate = await loadGate()

    await gate.evaluateLoginGate(route("/"))

    expect(gate.isLoginGateActive.value).toBe(false)
  })

  test.each(["/enter", "/view/abc/1"])(
    "keeps public route %s reachable",
    async (path) => {
      requires(["OIDC"])
      const gate = await loadGate()

      await gate.evaluateLoginGate(route(path))

      expect(gate.isLoginGateActive.value).toBe(false)
      expect(auth.signInUserWithOIDC).not.toHaveBeenCalled()
    }
  )

  test("redirects straight to SSO when it is the only login method", async () => {
    requires(["OIDC"])
    const gate = await loadGate()

    await gate.evaluateLoginGate(route("/"))

    expect(gate.isLoginGateActive.value).toBe(true)
    expect(gate.isRedirectingToLogin.value).toBe(true)
    expect(auth.signInUserWithOIDC).toHaveBeenCalledTimes(1)
  })

  test("shows the sign-in screen when there are several login methods", async () => {
    requires(["OIDC", "EMAIL"])
    const gate = await loadGate()

    await gate.evaluateLoginGate(route("/"))

    expect(gate.isLoginGateActive.value).toBe(true)
    expect(gate.isRedirectingToLogin.value).toBe(false)
    expect(auth.signInUserWithOIDC).not.toHaveBeenCalled()
  })

  test("doesn't redirect again within the cooldown (redirect-loop guard)", async () => {
    requires(["OIDC"])
    let gate = await loadGate()
    await gate.evaluateLoginGate(route("/"))

    // back from the identity provider, still without a session
    vi.resetModules()
    gate = await loadGate()
    await gate.evaluateLoginGate(route("/"))

    expect(auth.signInUserWithOIDC).toHaveBeenCalledTimes(1)
    expect(gate.isLoginGateActive.value).toBe(true)
    expect(gate.isRedirectingToLogin.value).toBe(false)
  })

  test("doesn't sign the user straight back in after they signed out", async () => {
    requires(["OIDC"])
    const gate = await loadGate()

    gate.noteExplicitSignOut()
    await gate.evaluateLoginGate(route("/"))

    expect(auth.signInUserWithOIDC).not.toHaveBeenCalled()
    expect(gate.isLoginGateActive.value).toBe(true)
  })

  test("signing in clears the sign-out marker", async () => {
    requires(["OIDC"])
    const gate = await loadGate()
    gate.noteExplicitSignOut()

    auth.getCurrentUser.mockReturnValue({ uid: "u1" })
    await gate.evaluateLoginGate(route("/"))
    auth.getCurrentUser.mockReturnValue(null)
    await gate.evaluateLoginGate(route("/"))

    expect(auth.signInUserWithOIDC).toHaveBeenCalledTimes(1)
  })
})
