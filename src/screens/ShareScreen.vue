<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { drawShareCard, shareText, type ShareCardData } from '../services/shareCard'
import { useGameStore } from '../stores/game'
import { useUiStore } from '../stores/ui'

const game = useGameStore()
const ui = useUiStore()
const canvas = ref<HTMLCanvasElement | null>(null)

const data = computed<ShareCardData | null>(() => {
  if (!game.game || !game.ending || !game.identity) return null
  const time = game.timeView
  if (!time) return null
  return {
    ending: game.ending.ending,
    identity: game.identity,
    stats: game.game.stats,
    choiceCount: game.game.history.length,
    choiceHours: time.choiceHours,
    restHours: time.restHours,
    completed: game.game.completed,
  }
})

function render() {
  if (!canvas.value || !data.value) return
  drawShareCard(canvas.value, data.value)
}

onMounted(() => nextTick(render))
watch(data, () => nextTick(render), { deep: true })

function download() {
  const target = canvas.value
  if (!target) return
  target.toBlob((blob) => {
    if (!blob) {
      ui.notify('图片生成失败，请重试。')
      return
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'one-more-week-share-card.png'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1800)
    ui.notify('分享卡 PNG 已生成并下载。')
  }, 'image/png')
}

async function copy() {
  if (!data.value) return
  const text = shareText(data.value)
  try {
    await navigator.clipboard.writeText(text)
    ui.notify('分享文案已复制。')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      ui.notify('分享文案已复制。')
    } catch {
      ui.notify('复制失败，请手动选择文案。')
    } finally {
      textarea.remove()
    }
  }
}
</script>

<template>
  <section class="share-screen screen">
    <div class="screen-topline">
      <button class="text-link" type="button" @click="game.setScreen('ending')">
        ← 返回结局
      </button>
      <span class="eyebrow">SHARE CARD / 分享卡片</span>
    </div>

    <template v-if="data">
      <div class="page-heading">
        <div>
          <span class="eyebrow">A WEEK TO KEEP</span>
          <h1>把这一周，<span class="highlight">分享给未来的自己。</span></h1>
          <p>分享卡在本地生成，不会上传你的记录。它只包含游戏名、结局、选择数、用时和两项状态。</p>
        </div>
        <span class="meta-pill">1200 × 630</span>
      </div>

      <div class="share-layout">
        <div class="share-preview-wrap">
          <canvas
            ref="canvas"
            class="share-canvas"
            width="1200"
            height="630"
            role="img"
            aria-label="结局分享卡预览"
          ></canvas>
          <p class="small-note">
            预览和下载使用同一张画布，避免预览与最终图片不一致。
          </p>
        </div>

        <aside class="share-controls card">
          <span class="eyebrow">EXPORT / 导出</span>
          <h2>生成你的结局卡</h2>
          <p>
            卡片包含「{{ data.ending.title }}」、{{ data.choiceCount }} 个关键选择、
            {{ data.choiceHours }} 小时选择用时，以及最能代表这个结局的两项状态。
          </p>
          <div class="share-summary">
            <div><strong>{{ data.choiceCount }}</strong><span>选择</span></div>
            <div><strong>{{ data.choiceHours }}h</strong><span>选择用时</span></div>
            <div><strong>{{ data.restHours }}h</strong><span>休息</span></div>
          </div>
          <button class="btn btn-primary btn-lg" type="button" @click="download">
            下载 PNG 分享卡 <span class="arrow">↓</span>
          </button>
          <button class="btn btn-quiet" type="button" @click="copy">
            复制分享文案
          </button>
          <button class="btn btn-quiet" type="button" @click="game.setScreen('ending')">
            返回结局报告
          </button>
          <p class="small-note">
            分享文案包含 #再来一周 #1024程序员节 话题标签，方便公开发布时使用。
          </p>
        </aside>
      </div>
    </template>

    <div v-else class="empty-state card">
      <strong>还没有结局卡</strong>
      <p>完成一周后，才能生成分享卡。</p>
      <button class="btn btn-primary" type="button" @click="game.setScreen('cover')">
        回到封面
      </button>
    </div>
  </section>
</template>
