<script setup lang="ts">
import { ref } from 'vue'
import { downloadText, readFileAsText } from '../lib/files'
import { identityVoice } from '../game/voice'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import { useVoiceStore } from '../stores/voice'

const game = useGameStore()
const settings = useSettingsStore()
const ui = useUiStore()
const voice = useVoiceStore()

type Tab = 'display' | 'audio' | 'data' | 'about'
const tab = ref<Tab>('display')
const importInput = ref<HTMLInputElement | null>(null)

function chooseTheme(theme: 'light' | 'dark') {
  settings.update({ theme })
}

function chooseTextSize(textSize: 'small' | 'normal' | 'large') {
  settings.update({ textSize })
}

function toggle(key: 'reduceMotion' | 'highContrast' | 'autoSave' | 'voiceEnabled' | 'petEnabled') {
  if (key === 'reduceMotion') settings.update({ reduceMotion: !settings.reduceMotion })
  if (key === 'highContrast') settings.update({ highContrast: !settings.highContrast })
  if (key === 'autoSave') settings.update({ autoSave: !settings.autoSave })
  if (key === 'voiceEnabled') settings.update({ voiceEnabled: !settings.voiceEnabled })
  if (key === 'petEnabled') settings.update({ petEnabled: !settings.petEnabled })
}

async function previewVoice() {
  const profile = identityVoice(game.selectedIdentityId)
  try {
    await voice.toggleSample(game.selectedIdentityId)
    if (voice.isSamplePlaying(game.selectedIdentityId)) {
      ui.notify(`正在播放：${profile.label}`)
    }
  } catch (error) {
    ui.notify(error instanceof Error ? error.message : '试听失败，请稍后再试。')
  }
}

function saveNow() {
  game.saveNow()
}

function openSaves() {
  game.openSaves()
}

function exportSave() {
  const json = game.exportJson()
  if (!json) {
    ui.notify('还没有可以导出的进度。')
    return
  }
  downloadText('one-more-week-save.json', json)
  ui.notify('存档 JSON 已导出。')
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const raw = await readFileAsText(file)
    game.importJson(raw)
  } catch {
    ui.notify('读取文件失败，请重试。')
  } finally {
    input.value = ''
  }
}

async function restart() {
  const ok = await ui.ask({
    title: '清空当前这一周？',
    copy: '当前进度会被清空；阅读偏好和已经创建的快照会保留。',
    confirmLabel: '清空这一周',
  })
  if (ok) game.restart()
}
</script>

<template>
  <section class="settings-screen screen">
    <div class="screen-topline">
      <button class="text-link" type="button" @click="game.closeOverlay()">← 返回</button>
      <span class="eyebrow">SETTINGS / 通用设置</span>
    </div>

    <div class="page-heading">
      <div>
        <span class="eyebrow">MAKE IT YOURS</span>
        <h1>让这一周，<span class="highlight">更符合你的节奏。</span></h1>
        <p>设置会立即生效，并保存在当前浏览器。游戏进度和阅读偏好分开存储。</p>
      </div>
      <span class="meta-pill">本地优先</span>
    </div>

    <div class="settings-layout">
      <nav class="settings-nav" aria-label="设置分类">
        <button
          type="button"
          :class="{ active: tab === 'display' }"
          @click="tab = 'display'"
        >
          <span>▧</span><span>画面与阅读</span>
        </button>
        <button type="button" :class="{ active: tab === 'audio' }" @click="tab = 'audio'">
          <span>♪</span><span>声音与 AI</span>
        </button>
        <button type="button" :class="{ active: tab === 'data' }" @click="tab = 'data'">
          <span>▣</span><span>存档与数据</span>
        </button>
        <button type="button" :class="{ active: tab === 'about' }" @click="tab = 'about'">
          <span>ⓘ</span><span>关于作品</span>
        </button>
      </nav>

      <div class="settings-content">
        <section v-if="tab === 'display'" class="settings-section card">
          <div class="settings-section-head">
            <h2>画面与阅读</h2>
            <p>漫画分镜是故事的一部分，但正文始终要能轻松读懂。</p>
          </div>

          <div class="setting-row">
            <div><strong>外观主题</strong><small>纸白漫画是默认阅读模式；深色模式适合夜间。</small></div>
            <div class="segmented" role="group" aria-label="外观主题">
              <button
                type="button"
                :class="{ active: settings.theme === 'light' }"
                @click="chooseTheme('light')"
              >
                纸白漫画
              </button>
              <button
                type="button"
                :class="{ active: settings.theme === 'dark' }"
                @click="chooseTheme('dark')"
              >
                深色阅读
              </button>
            </div>
          </div>

          <div class="setting-row">
            <div><strong>阅读字号</strong><small>影响正文与标题的整体比例，不会隐藏关键控件。</small></div>
            <div class="segmented" role="group" aria-label="阅读字号">
              <button
                type="button"
                :class="{ active: settings.textSize === 'small' }"
                @click="chooseTextSize('small')"
              >
                偏小
              </button>
              <button
                type="button"
                :class="{ active: settings.textSize === 'normal' }"
                @click="chooseTextSize('normal')"
              >
                标准
              </button>
              <button
                type="button"
                :class="{ active: settings.textSize === 'large' }"
                @click="chooseTextSize('large')"
              >
                偏大
              </button>
            </div>
          </div>

          <div class="setting-row">
            <div><strong>减少动态效果</strong><small>降低页面转场和位移；系统偏好也会被尊重。</small></div>
            <button
              class="switch"
              type="button"
              role="switch"
              aria-label="减少动态效果"
              :aria-checked="settings.reduceMotion"
              :class="{ on: settings.reduceMotion }"
              @click="toggle('reduceMotion')"
            >
              <span></span>
            </button>
          </div>

          <div class="setting-row">
            <div><strong>高对比度</strong><small>强化正文、控件边界和焦点状态。</small></div>
            <button
              class="switch"
              type="button"
              role="switch"
              aria-label="高对比度"
              :aria-checked="settings.highContrast"
              :class="{ on: settings.highContrast }"
              @click="toggle('highContrast')"
            >
              <span></span>
            </button>
          </div>
        </section>

        <section v-else-if="tab === 'audio'" class="settings-section card">
          <div class="settings-section-head">
            <h2>声音与 AI</h2>
            <p>语音与桌宠由 MiniMax 提供；MiniMax 文本不可用时降级到 StepFun。密钥只在服务端。</p>
          </div>

          <div class="setting-row">
            <div>
              <strong>角色语音</strong>
              <small>开启后可以用当前身份的声音朗读场景；桌宠的语音也会遵守这个开关。</small>
            </div>
            <button
              class="switch"
              type="button"
              role="switch"
              aria-label="角色语音"
              :aria-checked="settings.voiceEnabled"
              :class="{ on: settings.voiceEnabled }"
              @click="toggle('voiceEnabled')"
            >
              <span></span>
            </button>
          </div>

          <div class="setting-row">
            <div>
              <strong>试听当前身份</strong>
              <small>{{ identityVoice(game.selectedIdentityId).label }} · 静态样音，不消耗实时语音配额。</small>
            </div>
            <button class="btn btn-quiet" type="button" @click="previewVoice">
              {{ voice.isSamplePlaying(game.selectedIdentityId) ? '停止' : '试听' }}
            </button>
          </div>

          <div class="setting-row">
            <div>
              <strong>AI 桌宠「小鲸」</strong>
              <small>它会根据你的选择倾向和状态说一句观察，不替你决定，也不打断选项。</small>
            </div>
            <button
              class="switch"
              type="button"
              role="switch"
              aria-label="AI 桌宠"
              :aria-checked="settings.petEnabled"
              :class="{ on: settings.petEnabled }"
              @click="toggle('petEnabled')"
            >
              <span></span>
            </button>
          </div>

          <p class="small-note">
            讯飞语音备用接口预留中；当前无需登录讯飞即可使用 MiniMax 语音。语音需要网络和相应配额。
          </p>
        </section>

        <section v-else-if="tab === 'data'" class="settings-section card">
          <div class="settings-section-head">
            <h2>存档与数据</h2>
            <p>进度保存在当前浏览器，不会上传云端。清理网站数据前，建议先导出备份。</p>
          </div>

          <div class="setting-row">
            <div>
              <strong>自动存档</strong>
              <small>每次选择后自动保存。关闭后，刷新页面会回到上一次手动保存的进度。</small>
            </div>
            <button
              class="switch"
              type="button"
              role="switch"
              aria-label="自动存档"
              :aria-checked="settings.autoSave"
              :class="{ on: settings.autoSave }"
              @click="toggle('autoSave')"
            >
              <span></span>
            </button>
          </div>

          <div class="setting-row">
            <div><strong>保存当前进度</strong><small>立即写入浏览器本地存档。</small></div>
            <button class="btn btn-quiet" type="button" :disabled="!game.game" @click="saveNow">
              立即保存
            </button>
          </div>

          <div class="setting-row">
            <div><strong>存档快照</strong><small>创建多个可恢复的快照，或导入 / 导出一个 JSON 备份。</small></div>
            <div class="inline-actions">
              <button class="btn btn-quiet" type="button" @click="openSaves">打开存档列表</button>
              <button class="btn btn-quiet" type="button" :disabled="!game.game" @click="exportSave">
                导出 JSON
              </button>
              <button class="btn btn-quiet" type="button" @click="importInput?.click()">
                导入 JSON
              </button>
              <input
                ref="importInput"
                class="visually-hidden"
                type="file"
                accept="application/json,.json"
                @change="importFile"
              />
            </div>
          </div>

          <div class="setting-row setting-row--danger">
            <div><strong>重新开始</strong><small>清空当前这一周，保留阅读偏好和存档快照。</small></div>
            <button class="btn btn-danger" type="button" :disabled="!game.game" @click="restart">
              清空这一周
            </button>
          </div>
        </section>

        <section v-else class="settings-section card">
          <div class="settings-section-head">
            <h2>关于 One More Week</h2>
            <p>七天时间，每一个选择，都会在你的人生留下印记。</p>
          </div>
          <div class="about-copy">
            <p>
              《再来一周》是一款约 5–8 分钟可完成一轮的互动叙事游戏。你拥有一周 168 小时，
              在工作、学习、关系、休息与成长之间做出选择。游戏不替玩家判断什么叫成功，
              也不把休息视为失败。
            </p>
            <p>
              这是一次虚构情境模拟，不是命运预测、占卜、塔罗、八字或星盘分析。所有结局都由你的选择生成，
              不构成对真实未来的判断。
            </p>
            <p>
              视觉方向参考漫画编辑式排版，但角色、场景与界面素材均按本项目需要制作。
              角色语音由 MiniMax 提供；当前没有背景音乐，因此没有音量滑块。
            </p>
            <div class="tag-row">
              <span class="tag">Version 0.2</span>
              <span class="tag">Local-first</span>
              <span class="tag">Vue 3 + TypeScript</span>
              <span class="tag">168h / 7 days</span>
            </div>
          </div>
        </section>

        <div class="settings-foot">
          <span class="small-note">
            自动存档{{ settings.autoSave ? '已开启' : '已关闭' }} · 主题{{ settings.theme === 'dark' ? '深色' : '纸白' }}
          </span>
          <button class="btn btn-primary" type="button" @click="game.closeOverlay()">
            完成 <span class="arrow">✓</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
