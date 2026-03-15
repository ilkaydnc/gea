<script setup lang="ts">
import { ref } from 'vue'

const copied = ref(false)

function copyPage() {
  const doc = document.querySelector('.vp-doc')
  if (!doc) return

  const text = doc.innerText
  navigator.clipboard.writeText(text).then(() => {
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  })
}
</script>

<template>
  <div class="copy-page">
    <button @click="copyPage" class="copy-page-btn" :class="{ copied }">
      <svg
        v-if="!copied"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {{ copied ? 'Copied!' : 'Copy page' }}
    </button>
  </div>
</template>

<style scoped>
.copy-page {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.copy-page-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid rgba(0, 229, 255, 0.15);
  border-radius: 6px;
  background: rgba(0, 229, 255, 0.04);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-base);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.25s;
}

.copy-page-btn:hover {
  border-color: #00e5ff;
  color: #00e5ff;
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.15);
}

.copy-page-btn.copied {
  border-color: #00e5ff;
  color: #00e5ff;
}
</style>
