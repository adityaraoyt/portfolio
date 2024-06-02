import { defineNuxtPlugin } from '@nuxtjs/composition-api'
import { I18n, createI18n } from 'vue-i18n'
import { useLocaleStore } from '../composables/locale'

export default defineNuxtPlugin((nuxtApp: { vueApp: { use: (arg0: I18n<{}, {}, {}, any, false>) => void } }) => {
  const localeStore = useLocaleStore()

  const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: localeStore.getLocale || 'tr',
    fallbackLocale: 'tr',
    
  })

  nuxtApp.vueApp.use(i18n)
})

