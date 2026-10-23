<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { gameContent } from '../game/content'
import { useGameStore } from '../stores/game'
import { useUiStore } from '../stores/ui'
import { imageFor } from '../lib/images'
import { prefetchImagesAfterLoad } from '../lib/prefetch'

const game = useGameStore()
const ui = useUiStore()
const coverImage = imageFor('scene', '/images/scene-cover-window.webp')

onMounted(() => {
  prefetchImagesAfterLoad([
    imageFor('scene', '/images/scene-intro-city.webp').prefetchSrc,
    ...gameContent.identities.map(
      (identity) => imageFor('identity', identity.imageKey).prefetchSrc,
    ),
  ])
})

const hasProgress = computed(() => game.hasProgress)
const completed = computed(() => Boolean(game.game?.completed))
const currentDay = computed(() => game.game?.day ?? 1)
const identityName = computed(() => game.identity?.name ?? game.selectedIdentity.name)

const primaryLabel = computed(() => {
  if (hasProgress.value) return `继续第 ${currentDay.value} 天`
  if (completed.value) return '查看这一周的结局'
  return '开始我的一周'
})

function primaryAction() {
  if (hasProgress.value) {
    game.continueGame()
    return
  }
  if (completed.value) {
    game.viewEnding()
    return
  }
  game.setScreen('intro')
}

async function beginNewWeek() {
  if (game.game) {
    const ok = await ui.ask({
      title: '开始新的一周？',
      copy: '当前这一周的进度会被新的一周覆盖；已经创建的快照仍然保留。',
      confirmLabel: '开始新的一周',
    })
    if (!ok) return
  }
  game.setScreen('identity')
}
</script>

<template>
  <section class="cover-screen screen">
    <div class="cover-topline">
      <span class="brand-mark"><span>再来一周</span><i></i></span>
      <span class="cover-edition">ISSUE 001 · 2026.10.26 — 11.01</span>
    </div>

    <div class="cover-layout">
      <div class="cover-art">
        <img
          :src="coverImage.src"
          :srcset="coverImage.srcset"
          :sizes="coverImage.sizes"
          alt="窗边与清晨城市的漫画插画"
          fetchpriority="high"
          decoding="async"
        />
        <div class="cover-art-copy">
          <span class="comic-label">INTERACTIVE LIFE EXPERIMENT</span>
          <h1 class="cover-title">再来一周<span>One More Week</span></h1>
          <p class="cover-note">
            <strong>七天时间，<em>另一种可能。</em></strong>
            不是每一次选择都有标准答案。把这一周交给自己，看看你会走向怎样的生活。
          </p>
        </div>
      </div>

      <div class="cover-copy">
        <span class="eyebrow">A WEEK OF CHOICES · 168 HOURS</span>
        <h2>如果再来一周，<br />你会怎样<span class="highlight">生活？</span></h2>
        <p class="cover-lead">
          一款关于时间、选择与成长的互动叙事游戏。七天里，你会遇到工作、学习、关系与休息之间的真实取舍。
          没有完美答案，只有你愿意承担的选择。
        </p>

        <div class="cover-statline">
          <div><strong>168</strong><small>小时 · 你的时间</small></div>
          <div><strong>07</strong><small>天 · 一段旅程</small></div>
          <div><strong>05</strong><small>种 · 可能结局</small></div>
        </div>

        <div class="cover-actions">
          <button class="btn btn-primary btn-lg" type="button" @click="primaryAction">
            {{ primaryLabel }} <span class="arrow">→</span>
          </button>
          <button class="btn btn-quiet btn-lg" type="button" @click="game.setScreen('intro')">
            了解游戏 <span class="arrow">↗</span>
          </button>
        </div>
        <p class="small-note cover-current">
          当前身份：{{ identityName }}
          <template v-if="hasProgress"> · 已经历 {{ currentDay - 1 }}/7 天</template>
          <template v-else-if="completed"> · 这一周已完成</template>
          <template v-else> · 尚未开始</template>
        </p>
        <button
          v-if="game.game"
          class="text-link cover-restart"
          type="button"
          @click="beginNewWeek"
        >
          换一个身份，重新开始
        </button>
      </div>
    </div>

    <div class="feature-row">
      <div class="feature-item">
        <span class="feature-icon">▤</span>
        <div><strong>选择会留下痕迹</strong><p>每个决定都会影响时间、精力、成长、关系或金钱。</p></div>
      </div>
      <div class="feature-item">
        <span class="feature-icon">⌘</span>
        <div><strong>没有唯一正确答案</strong><p>工作、休息与关系都重要，关键是你的取舍。</p></div>
      </div>
      <div class="feature-item">
        <span class="feature-icon">✳</span>
        <div><strong>把一周变成故事</strong><p>回看关键瞬间，生成属于你的结局卡片。</p></div>
      </div>
    </div>

    <footer class="cover-footer">
      <span>ONE MORE WEEK <b>·</b> 再来一周</span>
      <span>一个关于时间、选择与成长的互动叙事实验</span>
      <span class="cover-local">无需登录 · 进度保存在当前浏览器</span>
    </footer>
  </section>
</template>
