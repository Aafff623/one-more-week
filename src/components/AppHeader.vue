<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'

const game = useGameStore()
const settings = useSettingsStore()
const ui = useUiStore()

const status = computed(() => {
  if (game.screen === 'game' && game.game) {
    if (game.phase === 'daySummary' && game.lastDaySummary) {
      return `第 ${game.lastDaySummary.day} 天结束 · 24h 已结算`
    }
    return `第 ${game.game.day} 天 · 今天自由 ${game.game.freeHoursLeft}h`
  }
  if (game.game?.completed) return '这一周已经结束'
  if (game.game) return '这一周还在继续'
  return '七天 · 168 小时人生实验'
})

async function goCover() {
  if (game.screen === 'game' && game.hasProgress) {
    const ok = await ui.ask({
      title: '先回到封面？',
      copy: '当前进度会留在本地，下次可以继续。',
      confirmLabel: '回到封面',
    })
    if (!ok) return
  }
  game.setScreen('cover')
}
</script>

<template>
  <header class="topbar">
    <button class="brand" type="button" aria-label="回到封面" @click="goCover">
      <span class="brand-mark"><span>再来一周</span><i></i></span>
      <span class="brand-copy">
        <strong>One More Week</strong>
        <small>Seven days. Every choice leaves a mark.</small>
      </span>
    </button>

    <div class="topbar-center">
      <span v-if="game.screen !== 'game'" class="topbar-status">{{ status }}</span>
      <span v-if="game.game && !settings.autoSave" class="tag tag-warn">自动存档关</span>
    </div>

    <div class="top-actions">
      <button
        v-if="game.game"
        class="icon-btn"
        type="button"
        :class="{ 'is-on': settings.voiceEnabled }"
        title="角色语音"
        :aria-label="settings.voiceEnabled ? '关闭角色语音' : '打开角色语音'"
        :aria-pressed="settings.voiceEnabled"
        @click="settings.update({ voiceEnabled: !settings.voiceEnabled })"
      >
        ♪
      </button>
      <button
        v-if="game.game"
        class="icon-btn"
        type="button"
        title="保存当前进度"
        aria-label="保存当前进度"
        @click="game.saveNow()"
      >
        ▣
      </button>
      <button
        class="icon-btn"
        type="button"
        title="设置"
        aria-label="打开设置"
        @click="game.openSettings()"
      >
        ⚙
      </button>
    </div>
  </header>
</template>
