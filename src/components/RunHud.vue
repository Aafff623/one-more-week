<script setup lang="ts">
import { computed } from 'vue'
import type { GameState, SlotId, StatKey, StoryEvent } from '../game/models'
import { getSlotHoursLeft } from '../game/engine'
import { SLOTS, STAT_KEYS, STAT_META, formatMoney } from '../game/rules'

const props = defineProps<{
  state: GameState
  event: StoryEvent | null
}>()

const weekLabels = ['一', '二', '三', '四', '五', '六', '日']

const weekDays = computed(() =>
  weekLabels.map((label, index) => {
    const day = index + 1
    return {
      day,
      label,
      status: day < props.state.day ? 'done' : day === props.state.day ? 'current' : 'upcoming',
    }
  }),
)

const periods = computed(() =>
  SLOTS.map((slot, index) => ({
    ...slot,
    index,
    status:
      index < props.state.eventIndex
        ? 'done'
        : index === props.state.eventIndex
          ? 'current'
          : 'upcoming',
    left: getSlotHoursLeft(props.state, slot.id),
  })),
)

const currentPeriod = computed<SlotId>(
  () => props.event?.period ?? SLOTS[Math.min(props.state.eventIndex, SLOTS.length - 1)].id,
)

const periodLabel = computed(
  () => SLOTS.find((slot) => slot.id === currentPeriod.value)?.label ?? '',
)

const weekPercent = computed(() =>
  Math.min(100, Math.round((props.state.totalHoursUsed / 168) * 100)),
)

function isMoney(key: StatKey): boolean {
  return key === 'money'
}

function value(key: StatKey): string {
  return isMoney(key) ? formatMoney(props.state.stats[key]) : String(props.state.stats[key])
}

function fill(key: StatKey): number {
  if (isMoney(key)) return Math.min(100, Math.round((props.state.stats[key] / 8000) * 100))
  return Math.max(0, Math.min(100, props.state.stats[key]))
}
</script>

<template>
  <section class="run-hud" aria-label="本周状态">
    <div class="run-hud-main">
      <div class="run-day">
        <span class="run-day-badge">{{ String(state.day).padStart(2, '0') }}</span>
        <div>
          <strong>周{{ weekLabels[state.day - 1] }} · {{ periodLabel }}</strong>
          <small>
            {{ event?.location ?? '这一周' }}
            <template v-if="event"> · {{ event.timeLabel }}</template>
          </small>
        </div>
      </div>

      <div class="run-week">
        <div class="run-week-days" aria-label="七天进度">
          <span
            v-for="day in weekDays"
            :key="day.day"
            class="run-week-day"
            :class="`is-${day.status}`"
          >
            <b>{{ String(day.day).padStart(2, '0') }}</b>
          </span>
        </div>
        <div class="run-week-bar" aria-hidden="true">
          <span :style="{ width: `${weekPercent}%` }"></span>
        </div>
        <small class="run-week-note">本周已记录 {{ state.totalHoursUsed }} / 168h</small>
      </div>

      <div class="run-stats">
        <span
          v-for="key in STAT_KEYS"
          :key="key"
          class="run-stat"
          :style="{ '--stat-color': STAT_META[key].color }"
        >
          <i>{{ STAT_META[key].icon }}</i>
          <b>{{ value(key) }}</b>
          <small>{{ STAT_META[key].label }}</small>
          <em aria-hidden="true"><span :style="{ width: `${fill(key)}%` }"></span></em>
        </span>
      </div>

      <div class="run-periods" aria-label="今天的四个时段">
        <span
          v-for="period in periods"
          :key="period.id"
          class="run-period"
          :class="`is-${period.status}`"
        >
          <b>{{ period.label }}</b>
          <small v-if="period.status === 'current'">{{ period.left }}h</small>
          <small v-else-if="period.status === 'done'">✓</small>
          <small v-else>{{ period.budget }}h</small>
        </span>
      </div>
    </div>
  </section>
</template>
