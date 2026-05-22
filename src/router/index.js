import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../components/AppLayout.vue'),
    children: [
      { path: '', component: () => import('../views/DashboardView.vue') },
      { path: 'products', component: () => import('../views/ProductsView.vue') },
      { path: 'products/:id', component: () => import('../views/ProductDetailView.vue') },
      { path: 'materials', component: () => import('../views/MaterialsView.vue') },
      { path: 'sales', component: () => import('../views/SalesView.vue') },
      { path: 'channels', component: () => import('../views/ChannelsView.vue') },
      { path: 'expenses', component: () => import('../views/ExpensesView.vue') },
      { path: 'settings', component: () => import('../views/SettingsView.vue') },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('access_token')
  if (!to.meta.public && !isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
