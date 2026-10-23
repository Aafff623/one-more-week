<script setup lang="ts">
import { onMounted } from 'vue'
import { gameContent } from '../game/content'
import { useGameStore } from '../stores/game'
import { imageFor } from '../lib/images'
import { prefetchImagesAfterLoad } from '../lib/prefetch'

const game = useGameStore()
const introImage = imageFor('scene', '/images/scene-intro-city.webp')

onMounted(() => {
  prefetchImagesAfterLoad(
    gameContent.identities.map((identity) => imageFor('identity', identity.imageKey).prefetchSrc),
  )
})
</script>

<template>
  <section class="intro-screen screen">
    <div class="screen-topline">
      <button class="text-link" type="button" @click="game.setScreen('cover')">← 回到封面</button>
      <span class="eyebrow">THE IDEA / 游戏介绍</span>
    </div>

    <div class="intro-layout">
      <div class="intro-copy">
        <span class="comic-label">YOUR LIFE, YOUR RULES</span>
        <h1>你拥有 <em>168</em> 小时，<br />会如何度过？</h1>
        <p>
          你会以一个生活身份进入一周，在每天的关键时刻做出选择。时间有限，精力会变化，关系需要维护，
          成长也需要投入。游戏会记录你的取舍，而不是替你决定什么叫成功。
        </p>

        <div class="rule-grid">
          <div class="rule-card">
            <span class="rule-number">168h</span>
            <strong>一周总时间</strong>
            <p>7 天 × 24 小时。每天有 12 小时用于睡眠与基本生活，剩下 12 小时由你安排。</p>
          </div>
          <div class="rule-card">
            <span class="rule-number">24h</span>
            <strong>每天都会结算</strong>
            <p>选择消耗本时段的自由时间；当天没用完的时间会自动变成休息，并小幅恢复精力与心情。</p>
          </div>
          <div class="rule-card">
            <span class="rule-number">04×7</span>
            <strong>每天四个时刻</strong>
            <p>上午、中午、下午、晚上各有一个关键事件，共 28 个事件。每个事件都有三个有代价的选项。</p>
          </div>
          <div class="rule-card">
            <span class="rule-number">05</span>
            <strong>不同结局</strong>
            <p>结局由你的状态和选择共同决定。没有唯一的好人生，休息不是失败。</p>
          </div>
        </div>

        <div class="intro-actions">
          <button class="btn btn-primary btn-lg" type="button" @click="game.setScreen('identity')">
            选择你的身份 <span class="arrow">→</span>
          </button>
          <button class="btn btn-quiet btn-lg" type="button" @click="game.setScreen('cover')">
            先看看封面
          </button>
        </div>
      </div>

      <aside class="intro-aside">
        <div class="intro-art">
          <img
            :src="introImage.src"
            :srcset="introImage.srcset"
            :sizes="introImage.sizes"
            alt="城市天际线的漫画插画"
            decoding="async"
          />
          <div class="intro-art-caption">
            <strong>Life is a story. You write the next week.</strong>
            <p>人生不是一道选择题，而是一段不断发生的故事。</p>
          </div>
        </div>
        <div class="notice-card">
          <span class="eyebrow">A NOTE / 关于这个实验</span>
          <p>
            这是一次虚构情境模拟，不是命运预测、占卜或运势分析。所有结局都由你的选择生成，
            不构成对真实未来的判断。
          </p>
          <p class="small-note">当前版本没有音轨，因此设置里不提供音量控制。</p>
        </div>
      </aside>
    </div>
  </section>
</template>
