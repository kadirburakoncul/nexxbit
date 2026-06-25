import { api } from './client'

export interface Notification {
  id: string; type: number; title: string; body: string
  isRead: boolean; createdAt: string
}
export interface NotificationsResult { items: Notification[]; unreadCount: number }

export const notificationsApi = {
  list: (params?: { pageNumber?: number; pageSize?: number }) =>
    api.get<NotificationsResult>('/notification', { params }).then(r => r.data),
  markRead: (id: string) =>
    api.put(`/notification/${id}/read`),
  markAllRead: () =>
    api.put('/notification/read-all'),
  delete: (id: string) =>
    api.delete(`/notification/${id}`),
  deleteAll: () =>
    api.delete('/notification'),
}
