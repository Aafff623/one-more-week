<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGameStore } from '../stores/game'
import { useUiStore } from '../stores/ui'
import { useVoiceStore } from '../stores/voice'
import { gameContent } from '../game/content'
import { STAT_META } from '../game/rules'
import { imageFor } from '../lib/images'
import { prefetchImage, prefetchModule } from '../lib/prefetch'

const game = useGameStore()
const ui = useUiStore()
const voice = useVoiceStore()

onMounted(() => {
  prefetchImage(imageFor('scene', gameContent.events[0].imageKey).prefetchSrc)
  prefetchModule(() => import('../screens/GameScreen.vue'))
})

const selected = computed(() => game.selectedIdentity)
const identities = gameContent.identities
const identityStatKeys = ['energy', 'growth', 'relationships'] as const

function portrait(identity: { imageKey: string }) {
  return imageFor('identity', identity.imageKey)
}

function selectIdentity(id: string) {
  game.selectedIdentityId = id
}

async function previewVoice() {
  try {
    await voice.toggleSample(selected.value.id)
  } catch (error) {
    ui.notify(error instanceof Error ? error.message : '试听失败，请稍后再试。')
  }
}

async function start() {
  if (game.game) {
    const ok = await ui.ask({
      title: '用这个身份开始新的一周？',
      copy: '当前这一周的进度会被覆盖；已经创建的快照仍然保留。',
      confirmLabel: '开始这一周',
    })
    if (!ok) return
  }
  game.start(game.selectedIdentityId)
}
</script>

<template>
  <section class="identity-screen screen">
    <div class="screen-topline">
      <button class="text-link" type="button" @click="game.setScreen('intro')">← 返回介绍</button>
      <span class="eyebrow">CHOOSE YOUR START / 选择身份</span>
    </div>

    <div class="page-heading">
      <div>
        <span class="eyebrow">FOUR STARTING POINTS</span>
        <h1>选择一个身份，<span class="highlight">开启你的一周。</span></h1>
        <p>身份决定初始状态和独白，不决定结局。你仍然可以做出完全不同的选择。</p>
      </div>
      <span class="meta-pill"><i class="dot"></i> 首版：大学生主线</span>
    </div>

    <div v-if="game.game" class="inline-banner">
      你已有一段进行中的一周。开始新游戏会覆盖当前进度，但不会删除手动快照。
    </div>

    <div class="identity-grid">
      <button
        v-for="identity in identities"
        :key="identity.id"
        class="identity-card"
        :class="{ 'is-selected': identity.id === game.selectedIdentityId }"
        type="button"
        :aria-pressed="identity.id === game.selectedIdentityId"
        @click="selectIdentity(identity.id)"
      >
        <div class="identity-image">
          <img
            :src="portrait(identity).src"
            :srcset="portrait(identity).srcset"
            :sizes="portrait(identity).sizes"
            :alt="`${identity.name}角色插画`"
            width="800"
            height="728"
            loading="lazy"
            decoding="async"
          />
          <span class="identity-check">✓</span>
        </div>
        <div class="identity-copy">
          <span class="role-label">{{ identity.english }}</span>
          <h2>{{ identity.name }}</h2>
          <p>{{ identity.description }}</p>
          <div class="identity-stats">
            <span v-for="key in identityStatKeys" :key="key">
              {{ STAT_META[key].label }} {{ identity.stats[key] }}
            </span>
          </div>
          <div class="tag-row">
            <span v-for="tag in identity.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </button>
    </div>

    <div class="identity-footer">
      <div>
        <p><strong>{{ selected.name }}</strong> · {{ selected.quote }}</p>
        <p class="small-note">
          首版以大学生的一周为主线；其他身份共享事件骨架，但初始状态和独白不同。之后会扩展各自的完整剧情。
        </p>
      </div>
      <div class="identity-footer-actions">
        <button class="btn btn-quiet" type="button" @click="previewVoice">
          {{ voice.isSamplePlaying(selected.id) ? '停止试听' : `试听「${selected.name}」的声音` }}
        </button>
        <button class="btn btn-primary btn-lg" type="button" @click="start">
          以「{{ selected.name }}」开始这一周 <span class="arrow">→</span>
        </button>
      </div>
    </div>
  </section>
</template>
