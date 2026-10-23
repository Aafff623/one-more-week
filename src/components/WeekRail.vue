<script setup lang="ts">
import type { GameState } from '../game/models'

defineProps<{ state: GameState }>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
</script>

<template>
  <div class="week-rail" aria-label="一周进度">
    <div
      v-for="(weekday, index) in weekdays"
      :key="weekday"
      class="week-day"
      :class="{
        'is-past': index + 1 < state.day,
        'is-current': index + 1 === state.day,
        'is-future': index + 1 > state.day,
      }"
    >
      <span class="week-day-no">
        {{ index + 1 < state.day ? '✓' : String(index + 1).padStart(2, '0') }}
      </span>
      <span class="week-day-name">周{{ weekday }}</span>
    </div>
  </div>
</template>
