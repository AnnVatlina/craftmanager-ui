<template>
  <div class="layout">
    <div class="overlay" :class="{ visible: sidebarOpen }" @click="sidebarOpen = false" />

    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-logo">✦ Craft<span>Manager</span></div>
      <nav class="sidebar-nav" @click="sidebarOpen = false">
        <router-link to="/"><span class="icon">📊</span> Дашборд</router-link>
        <router-link to="/products"><span class="icon">🧸</span> Изделия</router-link>
        <router-link to="/materials"><span class="icon">🧵</span> Материалы</router-link>
        <router-link to="/sales"><span class="icon">💰</span> Продажи</router-link>
        <router-link to="/buyers"><span class="icon">👥</span> Покупатели</router-link>
        <router-link to="/expenses"><span class="icon">📋</span> Расходы</router-link>
        <router-link to="/settings"><span class="icon">⚙️</span> Настройки</router-link>
      </nav>
      <div class="sidebar-footer">
        <button class="btn-logout" @click="logout">Выйти</button>
      </div>
    </aside>

    <div class="mobile-header">
      <button class="hamburger" @click="sidebarOpen = !sidebarOpen">☰</button>
      <span style="color:#f8fafc;font-weight:600;">✦ CraftManager</span>
    </div>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { authStore } from '../stores/auth.js'
import { settingsStore } from '../stores/settings.js'

const sidebarOpen = ref(false)
const logout = () => authStore.logout()

onMounted(() => settingsStore.load())
</script>
