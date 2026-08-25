import { api } from './client.js'

export const importApi = {
  importCsv: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.upload('/api/v1/import/csv', form)
  },
}
