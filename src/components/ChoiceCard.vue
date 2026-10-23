<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Choice, ChoiceAvailability, Effect } from '../game/models'
import { effectLabel } from '../game/rules'

const props = defineProps<{
  choice: Choice
  index: number
  availability: ChoiceAvailability
  effects: Effect[]
  multiplier: number
  thumb: string
  fallbackThumb?: string
}>()

const emit = defineEmits<{ select: [] }>()

const thumbSrc = ref(props.thumb)
const thumbVisible = ref(Boolean(props.thumb))

watch(
  () => props.thumb,
  (value) => {
    thumbSrc.value = value
    thumbVisible.value = Boolean(value)
  },
)

function onThumbError() {
  if (props.fallbackThumb && thumbSrc.value !== props.fallbackThumb) {
    thumbSrc.value = props.fallbackThumb
    return
  }
  thumbVisible.value = false
}
</script>

<template>
  <button
    class="choice-card"
    type="button"
    :class="{ 'is-disabled': !availability.ok, [`tone-${choice.tone}`]: true }"
    :disabled="!availability.ok"
    @click="emit('select')"
  >
    <span class="choice-visual">
      <img
        v-if="thumbVisible && thumbSrc"
        :src="thumbSrc"
        :alt="`${choice.title}的场景细节`"
        width="200"
        height="133"
        decoding="async"
        @error="onThumbError"
      />
      <span class="choice-letter" :class="{ 'is-overlay': thumbVisible && thumbSrc }">
        {{ String.fromCharCode(65 + index) }}
      </span>
    </span>
    <span class="choice-body">
      <span class="choice-head">
        <strong>{{ choice.title }}</strong>
        <span class="choice-time">{{ choice.hours }} 小时</span>
      </span>
      <small>{{ choice.detail }}</small>
      <span class="effect-row">
        <span
          v-for="effect in effects"
          :key="`${effect.stat}-${effect.value}`"
          class="effect"
          :class="{ negative: effect.value < 0 }"
        >
          {{ effectLabel(effect) }}
        </span>
        <span v-if="choice.hint" class="tag">{{ choice.hint }}</span>
        <span v-if="multiplier > 1" class="tag tag-multiplier">
          倾向 ×{{ multiplier.toFixed(1) }}
        </span>
      </span>
      <span v-if="!availability.ok" class="choice-disabled">
        {{ availability.reason }}
      </span>
    </span>
    <span class="choice-arrow" aria-hidden="true">↗</span>
  </button>
</template>
