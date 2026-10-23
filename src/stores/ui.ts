import { defineStore } from 'pinia'

export interface ConfirmOptions {
  title: string
  copy?: string
  confirmLabel?: string
  cancelLabel?: string
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useUiStore = defineStore('ui', {
  state: () => ({
    message: '',
    confirmRequest: null as ConfirmRequest | null,
  }),
  actions: {
    notify(message: string, duration = 2800) {
      this.message = message
      if (toastTimer) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => {
        this.message = ''
      }, duration)
    },
    ask(options: ConfirmOptions): Promise<boolean> {
      if (this.confirmRequest) this.confirmRequest.resolve(false)
      return new Promise((resolve) => {
        this.confirmRequest = { ...options, resolve }
      })
    },
    answer(value: boolean) {
      const request = this.confirmRequest
      this.confirmRequest = null
      request?.resolve(value)
    },
  },
})
