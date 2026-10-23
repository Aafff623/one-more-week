<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import ChoiceCard from '../components/ChoiceCard.vue'
import GamePet from '../components/GamePet.vue'
import RunHud from '../components/RunHud.vue'
import {
  getChoiceAvailability,
  getEffectiveEffects,
  getSlotHoursLeft,
  getToneMultiplier,
} from '../game/engine'
import type { Choice, Effect, SlotId } from '../game/models'
import { choiceImageKey, choiceThumbKey } from '../game/choiceImages'
import { gameContent } from '../game/content'
import { SLOTS, TONE_KEYS, TONE_META, effectLabel, formatMoney } from '../game/rules'
import { identityVoice } from '../game/voice'
import { imageFor } from '../lib/images'
import { prefetchImage, prefetchModule } from '../lib/prefetch'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import { useVoiceStore } from '../stores/voice'

const game = useGameStore()
const settings = useSettingsStore()
const ui = useUiStore()
const voice = useVoiceStore()

const state = computed(() => game.game)
const identity = computed(() => game.identity)
const event = computed(() => game.currentEvent)
const phase = computed(() => game.phase)
const outcome = computed(() => game.lastOutcome)
const summary = computed(() => game.lastDaySummary)
const echoes = computed(() =>
  state.value && state.value.eventIndex === 0 ? state.value.echoes : [],
)
const history = computed(() => (state.value ? [...state.value.history].reverse() : []))
const sceneSources = computed(() =>
  event.value ? imageFor('scene', event.value.imageKey) : null,
)
const identitySources = computed(() =>
  identity.value ? imageFor('identity', identity.value.imageKey) : null,
)
const resultSources = computed(() =>
  outcome.value ? imageFor('choice', choiceImageKey(outcome.value.record.choiceId)) : null,
)

const toneLine = computed(() => {
  if (!state.value) return []
  return TONE_KEYS.map((tone) => ({
    tone,
    label: TONE_META[tone].label,
    color: TONE_META[tone].color,
    count: state.value?.tendencies[tone] ?? 0,
  })).filter((item) => item.count > 0)
})

const nextSlotLabel = computed(() => {
  if (!state.value) return '继续'
  return SLOTS[state.value.eventIndex + 1]?.label ?? ''
})

const currentSlotLeft = computed(() => {
  if (!state.value || !event.value) return 0
  return getSlotHoursLeft(state.value, event.value.period)
})

const sceneLabel = computed(() =>
  phase.value === 'consequence' ? 'CHOICE RECORDED' : event.value?.category ?? '',
)

const sceneTitle = computed(() =>
  phase.value === 'consequence' && outcome.value
    ? outcome.value.record.choiceTitle
    : event.value?.title ?? '',
)

const sceneNarrative = computed(() =>
  phase.value === 'consequence' && outcome.value
    ? outcome.value.record.outcome
    : event.value?.narrative ?? '',
)

function hideBrokenImage(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}

function prefetchNextScene() {
  if (!state.value || !event.value) return
  const events = game.dayEvents
  const index = events.findIndex((item) => item.id === event.value?.id)
  const next = index >= 0 && index < events.length - 1
    ? events[index + 1]
    : gameContent.events.find((item) => item.day === state.value!.day + 1)
  if (next) prefetchImage(imageFor('scene', next.imageKey).prefetchSrc)
}

const voiceProfile = computed(() => identityVoice(state.value?.identityId ?? 'student'))
const sceneReadText = computed(() => {
  if (phase.value === 'consequence' && outcome.value) {
    return `${outcome.value.record.choiceTitle}。${outcome.value.record.outcome}`
  }
  if (event.value) return `${event.value.title}。${event.value.narrative}`
  return ''
})
const sceneSpeaking = computed(() => voice.isTextPlaying('scene'))

async function readScene() {
  if (!sceneReadText.value) return
  if (!settings.voiceEnabled) settings.update({ voiceEnabled: true })
  try {
    await voice.toggleText(sceneReadText.value, voiceProfile.value, 'scene')
  } catch (error) {
    ui.notify(error instanceof Error ? error.message : '语音暂时不可用。')
  }
}

function multiplier(choice: Choice): number {
  return state.value ? getToneMultiplier(state.value, choice.tone) : 1
}

function choiceEffects(choice: Choice): Effect[] {
  return state.value ? getEffectiveEffects(state.value, choice) : choice.effects
}

function toneLabel(tone: string): string {
  return TONE_META[tone as keyof typeof TONE_META]?.label ?? tone
}

function slotLabel(period: string): string {
  return SLOTS.find((slot) => slot.id === period)?.label ?? period
}

function slotLeft(period: string): number {
  return state.value ? getSlotHoursLeft(state.value, period as SlotId) : 0
}

const phaseLabel = computed(() => {
  if (phase.value === 'consequence') return '选择后果'
  if (phase.value === 'daySummary') return '一天结束'
  return '做出选择'
})

const heading = computed(() => {
  if (!state.value) return '这一周'
  if (phase.value === 'daySummary') return `第 ${summary.value?.day ?? state.value.day} 天结束`
  if (phase.value === 'consequence') return '你的选择，已经写进这一周。'
  return event.value?.title ?? '这一周'
})

const displayDay = computed(() =>
  phase.value === 'daySummary'
    ? (summary.value?.day ?? state.value?.day ?? 1)
    : (state.value?.day ?? 1),
)

function availability(choice: Choice) {
  if (!state.value || !event.value) return { ok: false, reason: '当前没有可执行的事件' }
  return getChoiceAvailability(state.value, event.value, choice)
}

function choose(choice: Choice) {
  if (!availability(choice).ok) return
  game.choose(choice.id)
}

function effectText(effect: { stat: string; value: number }) {
  return effectLabel(effect as { stat: Parameters<typeof effectLabel>[0]['stat']; value: number })
}

function money(value: number) {
  return formatMoney(value)
}

function handleKeydown(event: KeyboardEvent) {
  if (phase.value !== 'choice') return
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (!/^[1-3]$/.test(event.key)) return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  const choice = game.currentEvent?.choices[Number(event.key) - 1]
  if (choice && availability(choice).ok) {
    event.preventDefault()
    choose(choice)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.scrollTo({ top: 0, behavior: 'auto' })
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  prefetchModule(() => import('../screens/EndingScreen.vue'))
})
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

watch(
  () => [game.phase, game.game?.day, game.game?.eventIndex],
  async () => {
    await nextTick()
    if (phase.value === 'consequence') return
    const reduce = settings.reduceMotion ? 'auto' : 'smooth'
    window.scrollTo({ top: 0, behavior: reduce })
  },
)
</script>

<template>
  <section v-if="state && identity" class="game-screen screen">
    <div class="game-headline" :class="{ 'is-summary': phase === 'daySummary' }">
      <div>
        <span class="eyebrow">
          DAY {{ String(displayDay).padStart(2, '0') }} / {{ phaseLabel }}
        </span>
        <h1>{{ heading }}</h1>
      </div>
    </div>

    <RunHud v-if="phase !== 'daySummary'" :state="state" :event="event" />

    <template v-if="(phase === 'choice' || phase === 'consequence') && event">
      <div v-if="phase === 'choice' && echoes.length" class="echo-stack" aria-live="polite">
        <article v-for="echo in echoes" :key="echo.id" class="echo-card">
          <span class="eyebrow">ECHO / 延迟回响</span>
          <strong>第 {{ echo.sourceDay }} 天埋下的事，今天回来了</strong>
          <p>{{ echo.note }}</p>
          <div class="effect-row">
            <span
              v-for="effect in echo.appliedEffects"
              :key="`${effect.stat}-${effect.value}`"
              class="effect"
              :class="{ negative: effect.value < 0 }"
            >
              {{ effectText(effect) }}
            </span>
            <span v-if="echo.appliedEffects.length === 0" class="small-note">
              没有产生新的数值变化，但这件事仍然发生了。
            </span>
          </div>
        </article>
      </div>

      <div class="game-grid">
        <div class="story-column">
          <figure class="scene-frame">
            <img
              :src="sceneSources?.src"
              :srcset="sceneSources?.srcset"
              :sizes="sceneSources?.sizes"
              :alt="`${event.title}的场景插画`"
              fetchpriority="high"
              decoding="async"
              @load="prefetchNextScene"
            />
            <div class="scene-overlay"></div>
            <figcaption class="scene-copy">
              <span class="comic-label">{{ sceneLabel }}</span>
              <h2>{{ sceneTitle }}</h2>
              <p>{{ sceneNarrative }}</p>
            </figcaption>
            <span class="scene-time">{{ event.weekday }} · {{ event.timeLabel }}</span>
            <button
              class="scene-read"
              type="button"
              :aria-label="sceneSpeaking ? '停止朗读' : '朗读当前场景'"
              @click.stop="readScene"
            >
              {{ sceneSpeaking ? '停止' : '朗读' }}
            </button>
          </figure>

          <div class="inner-voice">
            <img
              :src="identitySources?.src"
              :srcset="identitySources?.srcset"
              :sizes="identitySources?.sizes"
              :alt="`${identity.name}肖像`"
              width="800"
              height="728"
              loading="lazy"
              decoding="async"
            />
            <div>
              <strong>内心独白 · {{ identity.name }}</strong>
              <p>“{{ identity.quote }}”</p>
            </div>
          </div>
        </div>

        <aside
          class="choice-panel"
          :class="{ 'choice-panel--result': phase === 'consequence' }"
          :aria-live="phase === 'consequence' ? 'polite' : undefined"
        >
          <template v-if="phase === 'choice'">
            <div class="choice-panel-head">
              <div>
                <div v-if="toneLine.length || state.toneStreak >= 3" class="tone-line">
                  <span class="eyebrow">TENDENCIES / 本周倾向</span>
                  <span
                    v-for="item in toneLine"
                    :key="item.tone"
                    class="tone-chip"
                    :style="{ '--tone-color': item.color }"
                  >
                    {{ item.label }} ×{{ item.count }}
                  </span>
                  <span v-if="state.toneStreak >= 3 && state.lastTone" class="tone-streak">
                    连续 {{ state.toneStreak }} 次{{ toneLabel(state.lastTone) }}，效果会放大
                  </span>
                </div>
                <span class="eyebrow">WHAT WILL YOU DO?</span>
                <h2>{{ event.prompt }}</h2>
                <p>这个时段还剩 {{ currentSlotLeft }} 小时。没有完美选项，先看看你愿意付出什么。</p>
              </div>
              <span class="small-note">{{ slotLabel(event.period) }} · {{ event.timeLabel }}</span>
            </div>
            <div class="choice-list">
              <ChoiceCard
                v-for="(choice, index) in event.choices"
                :key="choice.id"
                :choice="choice"
                :index="index"
                :availability="availability(choice)"
                :effects="choiceEffects(choice)"
                :multiplier="multiplier(choice)"
                :thumb="choiceThumbKey(choice.id)"
                :fallback-thumb="event.imageKey"
                @select="choose(choice)"
              />
            </div>
            <details class="history-panel history-panel--inline">
              <summary>
                这一周的选择
                <span>{{ state.history.length }} 条</span>
              </summary>
              <div v-if="history.length === 0" class="empty-note">
                还没有记录。做出第一个选择后，它会出现在这里。
              </div>
              <ol v-else class="history-list">
                <li v-for="record in history" :key="`${record.eventId}-${record.createdAt}`">
                  <span class="history-day">第 {{ record.day }} 天</span>
                  <div>
                    <strong>{{ record.choiceTitle }}</strong>
                    <small>{{ slotLabel(record.period) }} · {{ record.eventTitle }} · {{ record.hours }} 小时</small>
                    <div class="effect-row">
                      <span
                        v-for="effect in record.effects"
                        :key="`${effect.stat}-${effect.value}`"
                        class="effect"
                        :class="{ negative: effect.value < 0 }"
                      >
                        {{ effectText(effect) }}
                      </span>
                    </div>
                  </div>
                </li>
              </ol>
            </details>
            <div class="choice-foot">
              <span>本周已记录 {{ state.totalHoursUsed }} / 168h</span>
              <span>现金 ¥{{ money(state.stats.money) }}</span>
            </div>
          </template>

          <template v-else-if="phase === 'consequence' && outcome">
            <div class="result-panel result-panel--inline">
              <figure class="result-insert">
                <img
                  :src="resultSources?.src"
                  :srcset="resultSources?.srcset"
                  :sizes="resultSources?.sizes"
                  :alt="`${outcome.record.choiceTitle}的场景细节`"
                  decoding="async"
                  @error="hideBrokenImage"
                />
              </figure>
              <div class="result-card">
                <span class="eyebrow">YOUR ACTION / 本次行动</span>
                <h2>{{ outcome.record.choiceTitle }}</h2>
                <p>
                  {{ outcome.event.title }} · {{ slotLabel(outcome.record.period) }} ·
                  {{ outcome.record.hours }} 小时
                </p>
                <div class="effect-row">
                  <span
                    v-for="effect in outcome.effects"
                    :key="`${effect.stat}-${effect.value}`"
                    class="effect"
                    :class="{ negative: effect.value < 0 }"
                  >
                    {{ effectText(effect) }}
                  </span>
                  <span v-if="outcome.effects.length === 0" class="small-note">
                    状态已经到边界，这次没有产生新的数值变化。
                  </span>
                </div>
                <p v-if="outcome.multiplier > 1" class="small-note tendency-note">
                  连续第 {{ state.toneStreak }} 次「{{ toneLabel(outcome.record.tone) }}」选择，
                  效果按倾向放大到 ×{{ outcome.multiplier.toFixed(1) }}。
                </p>
                <div class="rule"></div>
                <p class="small-note">
                  {{ slotLabel(outcome.record.period) }}还剩
                  {{ slotLeft(outcome.record.period) }} 小时；今天还有
                  {{ state.freeHoursLeft }} 小时自由时间。未用时间会在日终变成休息。
                </p>
              </div>

              <div v-if="outcome.delayedNotes.length" class="delayed-card">
                <span class="eyebrow">CONSEQUENCE / 这件事会回来</span>
                <p v-for="note in outcome.delayedNotes" :key="note">{{ note }}</p>
                <p class="small-note">它不是每次选择都会出现，但这一次确实留下了余波。</p>
              </div>

              <div class="result-actions">
                <button class="btn btn-primary btn-lg" type="button" @click="game.continueAfterChoice()">
                  {{ outcome.lastEventOfDay ? '结束这一天' : `继续${nextSlotLabel}` }}
                  <span class="arrow">→</span>
                </button>
                <button class="btn btn-quiet" type="button" @click="game.openSaves()">
                  查看存档
                </button>
              </div>
            </div>
          </template>
        </aside>
      </div>
    </template>

    <template v-else-if="phase === 'daySummary' && summary">
      <div class="day-summary-layout" aria-live="polite">
        <article class="day-summary-card">
          <span class="comic-label">DAY {{ String(summary.day).padStart(2, '0') }} / COMPLETE</span>
          <h2>{{ summary.day === 7 ? '这一周，走到了终点。' : '今天结束了。' }}</h2>
          <p v-if="summary.day < 7">
            第 {{ summary.day + 1 }} 天开始前，你会带着今天的状态继续。未用完的自由时间已经自动变成休息。
          </p>
          <p v-else>七天已经被完整地过完。接下来，看看这一周留下了什么。</p>

          <div v-if="summary.slots.length" class="day-slot-list">
            <div v-for="slot in summary.slots" :key="slot.period" class="day-slot-row">
              <span class="day-slot-period">
                {{ slot.label }}
                <small>{{ slot.timeLabel }}</small>
              </span>
              <div class="day-slot-story">
                <strong>{{ slot.eventTitle }}</strong>
                <small>{{ slot.choiceTitle }}</small>
              </div>
              <span class="day-slot-time">{{ slot.hours }}h · 休 {{ slot.restHours }}h</span>
            </div>
          </div>

          <div class="tone-summary">
            <span class="eyebrow">TODAY'S TENDENCIES / 今天的倾向</span>
            <span
              v-for="tone in TONE_KEYS"
              v-show="summary.toneCounts[tone] > 0"
              :key="tone"
              class="tone-chip"
              :style="{ '--tone-color': TONE_META[tone].color }"
            >
              {{ TONE_META[tone].label }} ×{{ summary.toneCounts[tone] }}
            </span>
            <span
              v-if="!TONE_KEYS.some((tone) => (summary?.toneCounts[tone] ?? 0) > 0)"
              class="small-note"
            >
              今天还没有形成明显倾向。
            </span>
          </div>

          <div class="time-breakdown">
            <div><strong>{{ summary.fixedHours }}h</strong><span>固定生活</span></div>
            <div><strong>{{ summary.choiceHours }}h</strong><span>选择用时</span></div>
            <div><strong>{{ summary.restHours }}h</strong><span>自动休息</span></div>
            <div><strong>{{ summary.totalHours }}h</strong><span>今天合计</span></div>
          </div>

          <div class="rest-note">
            <strong>自动休息</strong>
            <div class="effect-row">
              <span
                v-for="effect in summary.restEffects"
                :key="`${effect.stat}-${effect.value}`"
                class="effect"
                :class="{ negative: effect.value < 0 }"
              >
                {{ effectText(effect) }}
              </span>
              <span v-if="summary.restEffects.length === 0" class="small-note">
                {{
                  summary.restHours === 0
                    ? '今天没有剩余自由时间，身体没有额外恢复。'
                    : '状态已经到了边界，这段休息没有带来额外数值变化。'
                }}
              </span>
            </div>
          </div>

          <div class="result-actions">
            <button class="btn btn-primary btn-lg" type="button" @click="game.continueAfterDay()">
              {{ state.completed ? '查看这一周的结局' : `进入第 ${summary.day + 1} 天` }}
              <span class="arrow">→</span>
            </button>
          </div>
        </article>
      </div>
    </template>

    <div v-else class="empty-state card">
      <strong>这一周已经结束了</strong>
      <p>回到结局报告，看看这一周留下了什么。</p>
      <button class="btn btn-primary" type="button" @click="game.viewEnding()">
        查看结局
      </button>
    </div>

    <GamePet />
  </section>

  <section v-else class="screen">
    <div class="empty-state card">
      <strong>还没有这一周</strong>
      <p>先选择一个身份，开始你的 168 小时。</p>
      <button class="btn btn-primary" type="button" @click="game.setScreen('identity')">
        选择身份
      </button>
    </div>
  </section>
</template>
