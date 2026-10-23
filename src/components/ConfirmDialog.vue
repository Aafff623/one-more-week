<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const confirmButton = ref<HTMLButtonElement | null>(null)
const card = ref<HTMLElement | null>(null)

watch(
  () => ui.confirmRequest,
  async (request) => {
    if (!request) return
    await nextTick()
    card.value?.focus()
  },
)

function answer(value: boolean) {
  ui.answer(value)
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="ui.confirmRequest"
      class="modal-backdrop"
      @click.self="answer(false)"
      @keydown.esc="answer(false)"
    >
      <div
        ref="card"
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        tabindex="-1"
      >
        <span class="eyebrow">ONE MORE WEEK / 确认</span>
        <h2 id="confirm-title">{{ ui.confirmRequest.title }}</h2>
        <p v-if="ui.confirmRequest.copy">{{ ui.confirmRequest.copy }}</p>
        <div class="modal-actions">
          <button class="btn btn-quiet" type="button" @click="answer(false)">
            {{ ui.confirmRequest.cancelLabel ?? '再想想' }}
          </button>
          <button
            ref="confirmButton"
            class="btn btn-primary"
            type="button"
            @click="answer(true)"
          >
            {{ ui.confirmRequest.confirmLabel ?? '确认' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
