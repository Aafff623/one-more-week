<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { requestPetComment } from '../game/companion'
import { petPayload } from '../game/pet'
import { PET_VOICE } from '../game/voice'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import { useVoiceStore } from '../stores/voice'

const game = useGameStore()
const settings = useSettingsStore()
const ui = useUiStore()
const voice = useVoiceStore()

const message = ref('')
const provider = ref('')
const loading = ref(false)
const minimized = ref(false)
const lastKey = ref('')
let controller: AbortController | null = null
let hideTimer: ReturnType<typeof setTimeout> | undefined

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = undefined
  }
}

function scheduleHide() {
  clearHideTimer()
  hideTimer = setTimeout(() => {
    minimized.value = true
  }, 7000)
}

const visible = computed(
  () => settings.petEnabled && Boolean(game.game) && (game.phase === 'choice' || game.phase === 'consequence'),
)
const bubbleVisible = computed(() => !minimized.value && (loading.value || Boolean(message.value)))
const petSpeaking = computed(() => voice.isTextPlaying('pet'))

async function requestComment(force = false) {
  const outcome = game.lastOutcome
  if (!outcome || !settings.petEnabled || !game.game) return
  const key = `${outcome.record.createdAt}:${game.game.history.length}`
  if (!force && key === lastKey.value) return
  lastKey.value = key
  controller?.abort()
  const active = new AbortController()
  controller = active
  clearHideTimer()
  minimized.value = false
  loading.value = true
  message.value = ''
  provider.value = ''
  try {
    const reply = await requestPetComment(petPayload(game.game, outcome), {
      signal: active.signal,
    })
    if (!reply) return
    message.value = reply.text
    provider.value = reply.provider
    scheduleHide()
  } finally {
    if (controller === active) loading.value = false
  }
}

onUnmounted(() => {
  controller?.abort()
  clearHideTimer()
})

async function replayVoice() {
  if (!message.value) return
  if (!settings.voiceEnabled) settings.update({ voiceEnabled: true })
  try {
    await voice.toggleText(message.value, PET_VOICE, 'pet')
  } catch (error) {
    ui.notify(error instanceof Error ? error.message : '语音暂时不可用。')
  }
}

function closePet() {
  settings.update({ petEnabled: false })
  clearHideTimer()
  if (petSpeaking.value) voice.stop()
  message.value = ''
  minimized.value = false
}

function togglePet() {
  minimized.value = !minimized.value
  if (!minimized.value) {
    if (!message.value && !loading.value) void requestComment(true)
    else scheduleHide()
  } else {
    clearHideTimer()
  }
}

watch(
  () => [game.phase, game.game?.history.length ?? 0, settings.petEnabled] as const,
  ([phase, , enabled]) => {
    if (enabled && phase === 'consequence') void requestComment()
  },
  { immediate: true },
)
</script>

<template>
  <aside v-if="visible" class="game-pet" aria-label="AI 桌宠小鲸">
    <Transition name="pet-bubble">
      <div v-if="bubbleVisible" class="pet-bubble" role="status" aria-live="polite">
        <div class="pet-bubble-head">
          <span class="pet-name">小鲸</span>
          <span class="pet-provider">{{ loading ? '正在想…' : provider }}</span>
          <button class="pet-close" type="button" aria-label="关闭 AI 桌宠" @click="closePet">
            ×
          </button>
        </div>
        <p>{{ loading ? '让我看看你刚刚选了什么。' : message }}</p>
        <div class="pet-bubble-actions">
          <button class="pet-mini" type="button" @click="replayVoice">
            {{ petSpeaking ? '停止朗读' : '朗读' }}
          </button>
          <button class="pet-mini" type="button" :disabled="loading" @click="requestComment(true)">
            换一句
          </button>
        </div>
      </div>
    </Transition>
    <button
      class="pet-button"
      type="button"
      :aria-label="minimized ? '展开小鲸的观察' : '收起小鲸的观察'"
      @click="togglePet"
    >
      <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
        <path
          d="M22 66c0-23 18-41 41-41 24 0 42 17 42 39 0 20-16 35-39 35-17 0-30-7-37-16l-16 9 3-19c-2-5-3-11-3-18Z"
          fill="#101b31"
          stroke="#101b31"
          stroke-width="3"
        />
        <path d="M33 74c7 11 20 17 34 17 18 0 31-9 35-22-9 8-21 13-36 13-14 0-25-3-33-8Z" fill="#e7ff66" />
        <path d="M34 47c-9-7-16-8-22-7 3 6 9 12 17 15Z" fill="#101b31" />
        <path d="M79 43c5-8 12-10 19-8-3 6-8 11-14 14Z" fill="#101b31" />
        <circle cx="76" cy="57" r="4.5" fill="#fff" />
        <circle cx="77" cy="57" r="2" fill="#101b31" />
        <path d="M68 70c4 3 8 3 12 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" />
        <path d="M51 40c2-9 7-14 12-18M57 22c1 6 4 9 8 11" fill="none" stroke="#101b31" stroke-width="3" stroke-linecap="round" />
        <path d="M45 35c-4 3-6 7-7 11" fill="none" stroke="#e7ff66" stroke-width="3" stroke-linecap="round" />
      </svg>
    </button>
  </aside>
</template>
