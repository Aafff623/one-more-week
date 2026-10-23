<script setup lang="ts">
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
</script>

<template>
  <Transition name="toast">
    <div v-if="ui.message" class="toast" role="status" aria-live="polite">
      {{ ui.message }}
    </div>
  </Transition>
</template>
