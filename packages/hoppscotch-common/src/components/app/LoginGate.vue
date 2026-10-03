<template>
  <div
    v-if="isLoginGateActive"
    class="fixed inset-0 z-[900] flex flex-col items-center justify-center bg-primary p-4 text-center"
  >
    <img src="/logo.svg" alt="" class="mb-6 h-16 w-16" />
    <h1 class="heading mb-2">{{ t("auth.login_required_title") }}</h1>
    <template v-if="isRedirectingToLogin">
      <p class="mb-6 text-secondaryLight">
        {{ t("auth.login_required_redirecting") }}
      </p>
      <HoppSmartSpinner />
    </template>
    <template v-else>
      <p class="mb-6 text-secondaryLight">
        {{ t("auth.login_required_description") }}
      </p>
      <HoppButtonPrimary
        :label="t('auth.login')"
        @click="invokeAction('modals.login.toggle')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue"
import { useI18n } from "@composables/i18n"
import { invokeAction } from "~/helpers/actions"
import { isLoginGateActive, isRedirectingToLogin } from "~/helpers/login-gate"

const t = useI18n()

// Open the login dialog right away, unless single sign-on is already redirecting
watch(
  [isLoginGateActive, isRedirectingToLogin],
  ([active, redirecting], [wasActive]) => {
    if (active && !wasActive && !redirecting)
      invokeAction("modals.login.toggle")
  }
)
</script>
