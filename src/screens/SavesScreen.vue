<script setup lang="ts">
import { computed, ref } from 'vue'
import { downloadText, readFileAsText } from '../lib/files'
import { useGameStore } from '../stores/game'
import { useUiStore } from '../stores/ui'

const game = useGameStore()
const ui = useUiStore()
const snapshotName = ref('')
const importInput = ref<HTMLInputElement | null>(null)

const current = computed(() => game.game)

const defaultSnapshotName = computed(() => {
  if (!game.game) return '手动快照'
  return `${game.identity?.name ?? '这一周'} · 第 ${game.game.day} 天`
})

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function saveSnapshot() {
  game.createSnapshot(snapshotName.value || defaultSnapshotName.value)
  snapshotName.value = ''
}

async function restore(id: string) {
  const ok = await ui.ask({
    title: '恢复这个存档？',
    copy: '当前进度会被这个快照替换。如果当前进度还没有手动保存，请先创建快照。',
    confirmLabel: '恢复存档',
  })
  if (ok) game.restoreSnapshot(id)
}

async function remove(id: string) {
  const ok = await ui.ask({
    title: '删除这个存档？',
    copy: '只会删除选中的快照，不影响当前进度和其他快照。',
    confirmLabel: '删除存档',
  })
  if (ok) game.deleteSnapshot(id)
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
</script>

<template>
  <section class="saves-screen screen">
    <div class="screen-topline">
      <button class="text-link" type="button" @click="game.closeOverlay()">← 返回</button>
      <span class="eyebrow">SAVES / 存档</span>
    </div>

    <div class="page-heading">
      <div>
        <span class="eyebrow">LOCAL SAVE / 本地存档</span>
        <h1>把进度，<span class="highlight">留在自己手里。</span></h1>
        <p>进度和快照只保存在当前浏览器。换设备或清理浏览器数据前，先导出一份 JSON 备份。</p>
      </div>
      <span class="meta-pill">{{ game.snapshots.length }} / 8 个快照</span>
    </div>

    <div class="saves-layout">
      <div class="save-main">
        <article class="current-save card">
          <div class="card-head">
            <div>
              <span class="eyebrow">CURRENT RUN / 当前进度</span>
              <h2>{{ current ? `第 ${current.day} 天` : '还没有进行中的一周' }}</h2>
              <p v-if="current">
                {{ game.identity?.name }} · 已记录 {{ current.totalHoursUsed }} / 168 小时 ·
                今天还剩 {{ current.freeHoursLeft }} 小时自由时间
              </p>
              <p v-else>开始一周后，这里会显示当前进度。</p>
            </div>
          </div>
          <div class="snapshot-form">
            <label for="snapshot-name">快照名称</label>
            <input
              id="snapshot-name"
              v-model="snapshotName"
              :placeholder="defaultSnapshotName"
              maxlength="60"
            />
            <button class="btn btn-primary" type="button" :disabled="!current" @click="saveSnapshot">
              保存为快照
            </button>
          </div>
        </article>

        <section class="snapshot-list">
          <div class="section-head">
            <h2>存档快照</h2>
            <span class="small-note">最多保留 8 个</span>
          </div>
          <div v-if="game.snapshots.length === 0" class="empty-state card">
            <strong>还没有快照</strong>
            <p>在关键选择前保存一个快照，之后可以回来走另一条路。</p>
          </div>
          <article v-for="snapshot in game.snapshots" :key="snapshot.id" class="snapshot-card card">
            <div>
              <span class="tag">第 {{ snapshot.day }} / 7 天</span>
              <h3>{{ snapshot.name }}</h3>
              <p>
                {{ snapshot.identityId }} · {{ formatDate(snapshot.createdAt) }} ·
                {{ snapshot.game.totalHoursUsed }} / 168 小时
              </p>
            </div>
            <div class="snapshot-actions">
              <button class="btn btn-primary btn-sm" type="button" @click="restore(snapshot.id)">
                恢复
              </button>
              <button class="btn btn-quiet btn-sm" type="button" @click="remove(snapshot.id)">
                删除
              </button>
            </div>
          </article>
        </section>
      </div>

      <aside class="save-side card">
        <span class="eyebrow">BACKUP / 备份</span>
        <h2>导出或导入</h2>
        <p>
          导出的 JSON 包含当前进度和所有快照。导入时会校验版本、状态范围和时间数据；
          无效文件不会覆盖现有进度。
        </p>
        <button class="btn btn-primary" type="button" :disabled="!current" @click="exportSave">
          导出 JSON 备份
        </button>
        <button class="btn btn-quiet" type="button" @click="importInput?.click()">
          导入 JSON 存档
        </button>
        <input
          ref="importInput"
          class="visually-hidden"
          type="file"
          accept="application/json,.json"
          @change="importFile"
        />
        <div class="rule"></div>
        <p class="small-note">
          浏览器隐私模式、清理网站数据或存储空间不足都可能让本地存档消失。
          这不是云存档。
        </p>
        <button class="btn btn-quiet" type="button" @click="game.closeOverlay()">返回</button>
      </aside>
    </div>
  </section>
</template>
