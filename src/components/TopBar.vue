<template>
  <header class="topbar-shell">
    <div class="topbar-left">
      <button class="nav-icon-button desktop-hidden" @click="$emit('menu')">☰</button>
      <div class="topbar-title-group">
        <h1>yuan-agent</h1>
        <p>{{ titleText }}</p>
      </div>
    </div>

    <div class="topbar-right">
      <button class="topbar-icon" @click="$emit('menu')">≡</button>
      <button class="topbar-chip" @click="$emit('toggle-rag')">
        {{ ragEnabled ? 'RAG On' : 'RAG Off' }}
      </button>
      <button class="topbar-chip" :disabled="disabled" @click="$emit('new-session')">新对话</button>
      <button class="topbar-chip stop-chip" :disabled="!isResponding" @click="$emit('stop')">停止输出</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  ragEnabled: boolean;
  documentCount: number;
  conversationId: string;
  messageCount: number;
  isResponding: boolean;
  disabled: boolean;
}>();

defineEmits<{
  menu: [];
  stop: [];
  'new-session': [];
  'toggle-rag': [];
}>();

const titleText = computed(
  () => `yuan-agent · 会话 ${props.conversationId.slice(0, 8)} · ${props.messageCount} 条消息 · ${props.documentCount} 份知识文档`
);
</script>
