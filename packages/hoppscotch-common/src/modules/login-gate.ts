import { HoppModule } from "."
import { evaluateLoginGate } from "~/helpers/login-gate"
import { platform } from "~/platform"

/**
 * Enforces sign-in when the instance requires it (see helpers/login-gate).
 */
export default <HoppModule>{
  onRouterInit(_app, router) {
    // Wait for the initial navigation so the real route (not the router's
    // start location) decides whether the page is public.
    router.isReady().then(() => {
      platform.auth
        .getCurrentUserStream()
        .subscribe(() => void evaluateLoginGate(router.currentRoute.value))
    })
  },

  onAfterRouteChange(to) {
    void evaluateLoginGate(to)
  },
}
