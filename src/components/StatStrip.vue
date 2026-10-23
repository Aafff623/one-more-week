<script setup lang="ts">
import type { Stats } from '../game/models'
import { STAT_KEYS, STAT_META, formatMoney } from '../game/rules'

defineProps<{ stats: Stats; compact?: boolean }>()

function barWidth(key: string, value: number) {
  if (key === 'money') return Math.min(100, Math.round((value / 8000) * 100))
  return Math.max(0, Math.min(100, value))
}
</script>

<template>
  <div class="stat-strip" :class="{ 'stat-strip--compact': compact }">
    <div v-for="key in STAT_KEYS" :key="key" class="stat-chip">
      <span class="stat-icon" :style="{ '--stat-color': STAT_META[key].color }">
        {{ STAT_META[key].icon }}
      </span>
      <div class="stat-main">
        <div class="stat-line">
          <strong>{{ key === 'money' ? formatMoney(stats[key]) : stats[key] }}</strong>
          <span>{{ STAT_META[key].label }}</span>
        </div>
        <div class="stat-track">
          <span
            :style="{
              width: `${barWidth(key, stats[key])}%`,
              '--stat-color': STAT_META[key].color,
            }"
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>
