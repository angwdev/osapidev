<template>
  <div v-if="accessConfigs" class="grid md:grid-cols-3 gap-4 md:gap-4 pt-8">
    <div class="md:col-span-1">
      <h3 class="heading">{{ t('configs.access.title') }}</h3>
      <p class="my-1 text-secondaryLight">
        {{ t('configs.access.description') }}
      </p>
    </div>

    <div class="sm:px-8 md:col-span-2">
      <section>
        <h4 class="font-semibold text-secondaryDark">
          {{ t('configs.access.title') }}
        </h4>

        <div class="space-y-4 py-4">
          <HoppSmartToggle
            :on="accessConfigs.fields.require_login"
            @change="
              accessConfigs.fields.require_login =
                !accessConfigs.fields.require_login
            "
          >
            {{ t('configs.access.require_login') }}
          </HoppSmartToggle>
          <p class="text-secondaryLight max-w-lg">
            {{ t('configs.access.require_login_note') }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import { computed } from 'vue';
import { useI18n } from '~/composables/i18n';
import { ServerConfigs } from '~/helpers/configs';

const t = useI18n();

const props = defineProps<{
  config: ServerConfigs;
}>();

const emit = defineEmits<{
  (e: 'update:config', v: ServerConfigs): void;
}>();

const workingConfigs = useVModel(props, 'config', emit);

const accessConfigs = computed(() => workingConfigs.value?.accessConfigs);
</script>
