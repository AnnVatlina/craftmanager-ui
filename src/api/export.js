import { api } from './client.js'

export const exportApi = {
  downloadCsv: () => api.download('/api/v1/export/csv', 'craftmanager_export.zip'),
}
