<script setup lang="ts">
import { computed, onMounted } from 'vue'
import StatStrip from '../components/StatStrip.vue'
import { effectLabel } from '../game/rules'
import { endingImageKey } from '../game/choiceImages'
import { imageFor } from '../lib/images'
import { prefetchModule } from '../lib/prefetch'
import { useGameStore } from '../stores/game'
import { useUiStore } from '../stores/ui'

const game = useGameStore()
const ui = useUiStore()

const state = computed(() => game.game)
const ending = computed(() => game.ending?.ending ?? null)
const explanation = computed(() => game.ending?.explanation ?? '')
const matched = computed(() => game.ending?.matched ?? [])
const identity = computed(() => game.identity)
const time = computed(() => game.timeView)
const moments = computed(() => {
  if (!state.value) return []
  const history = state.value.history
  if (history.length <= 4) return [...history].reverse()
  const indexes = [0, Math.round((history.length - 1) / 3), Math.round(((history.length - 1) * 2) / 3), history.length - 1]
  return [...new Set(indexes)].map((index) => history[index])
})

async function restart() {
  const ok = await ui.ask({
    title: '再来一周？',
    copy: '这一周的进度会被清空，但阅读偏好和已经创建的快照会保留。',
    confirmLabel: '再来一周',
  })
  if (ok) game.restart()
}

function endingVisual(id: string) {
  return imageFor('ending', endingImageKey(id))
}

function fallbackEndingImage(event: Event) {
  const image = event.target as HTMLImageElement
  if (image.dataset.fallback) return
  image.dataset.fallback = '1'
  image.removeAttribute('srcset')
  image.removeAttribute('sizes')
  image.src = '/images/scene-ending-silhouette.webp'
}

onMounted(() => {
  prefetchModule(() => import('../screens/ShareScreen.vue'))
})
</script>

<template>
  <section v-if="state && ending && identity && time" class="ending-screen screen">
    <div class="ending-topline">
      <span class="eyebrow">ENDING REPORT / 结局报告</span>
      <span class="meta-pill"><i class="dot"></i> 已完成 · 第 001 次</span>
    </div>

    <div class="ending-shell">
      <div class="ending-hero">
        <img
          :src="endingVisual(ending.id).src"
          :srcset="endingVisual(ending.id).srcset"
          :sizes="endingVisual(ending.id).sizes"
          :alt="`${ending.title}的结局场景`"
          width="1200"
          height="800"
          fetchpriority="high"
          decoding="async"
          @error="fallbackEndingImage"
        />
        <div class="ending-copy">
          <span class="comic-label">YOUR WEEK / YOUR STORY</span>
          <h1>这就是你的这一周。<span>也是另一种可能。</span></h1>
          <p>{{ ending.description }}</p>
          <p class="ending-identity">{{ identity.name }} · 七天 · 168 小时</p>
        </div>
        <div class="ending-badge">
          <span class="ending-icon">{{ ending.icon }}</span>
          <span class="eyebrow">YOUR ENDING / 你的结局</span>
          <strong>{{ ending.title }}</strong>
          <small>{{ ending.english }}</small>
        </div>
      </div>

      <StatStrip :stats="state.stats" compact />

      <div class="ending-body">
        <div class="ending-explanation">
          <span class="eyebrow">WHY THIS ENDING / 为什么是这个结局</span>
          <p>{{ explanation }}</p>
          <div v-if="matched.length" class="tag-row">
            <span v-for="reason in matched" :key="reason" class="tag">{{ reason }}</span>
          </div>
        </div>

        <div class="time-breakdown ending-time">
          <div><strong>{{ time.fixedHours }}h</strong><span>固定生活</span></div>
          <div><strong>{{ time.choiceHours }}h</strong><span>选择用时</span></div>
          <div><strong>{{ time.restHours }}h</strong><span>自动休息</span></div>
          <div><strong>{{ time.totalUsed }}h</strong><span>本周合计</span></div>
        </div>

        <div class="ending-moments">
          <div class="ending-section-head">
            <h3>这一周的几个瞬间</h3>
            <span class="small-note">共 {{ state.history.length }} 个选择</span>
          </div>
          <ol>
            <li v-for="record in moments" :key="`${record.eventId}-${record.createdAt}`">
              <span class="moment-day">第 {{ record.day }} 天</span>
              <div>
                <strong>{{ record.choiceTitle }}</strong>
                <small>{{ record.eventTitle }} · {{ record.hours }} 小时</small>
                <div class="effect-row">
                  <span
                    v-for="effect in record.effects"
                    :key="`${effect.stat}-${effect.value}`"
                    class="effect"
                    :class="{ negative: effect.value < 0 }"
                  >
                    {{ effectLabel(effect) }}
                  </span>
                </div>
              </div>
            </li>
          </ol>
        </div>

        <div class="ending-reflection">
          <span class="eyebrow">A NOTE FOR NEXT WEEK / 写给下一周的你</span>
          <p>{{ ending.reflection }}</p>
          <p class="small-note">
            这不是命运预测，也不是对真实生活的评分。它只是一次虚构实验里，你愿意承担的选择。
          </p>
        </div>
      </div>

      <div class="ending-actions">
        <button class="btn btn-primary btn-lg" type="button" @click="game.openShare()">
          生成分享卡 <span class="arrow">→</span>
        </button>
        <button class="btn btn-quiet" type="button" @click="restart">
          再来一周 ↻
        </button>
        <button class="btn btn-quiet" type="button" @click="game.setScreen('cover')">
          回到封面
        </button>
      </div>
    </div>
  </section>

  <section v-else class="screen">
    <div class="empty-state card">
      <strong>还没有可以查看的结局</strong>
      <p>先完整地过完这一周。</p>
      <button class="btn btn-primary" type="button" @click="game.setScreen('cover')">
        回到封面
      </button>
    </div>
  </section>
</template>
