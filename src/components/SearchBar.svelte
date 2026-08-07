<script lang="ts">
  interface SearchBarProps {
    searchQuery: string;
    onSearch: () => void;
    onClear: () => void;
    placeholder?: string;
  }

  let { searchQuery = $bindable(""), onSearch, onClear, placeholder = "Search..." } : SearchBarProps = $props();

  let queryNotEmpty = $derived(searchQuery !== "");
</script>

<header class="search-bar">
  <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
  <input type="text" placeholder={placeholder} oninput={onSearch} bind:value={searchQuery} />
  {#if queryNotEmpty}
    <button class="clear-btn" onclick={onClear} aria-label="Clear search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  {/if}
</header>

<style>
  .search-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 14px 16px 10px;
    padding: 10px 14px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 20px;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .search-bar:focus-within {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.25);
  }

  .search-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: #64748b;
  }

  .search-bar input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: #e2e8f0;
    font-size: 14px;
    font-family: inherit;
  }

  .search-bar input::placeholder {
    color: #64748b;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    padding: 0;
    background: rgba(148, 163, 184, 0.12);
    border: none;
    border-radius: 999px;
    color: #64748b;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      color 150ms ease,
      transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: pop-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .clear-btn svg {
    width: 12px;
    height: 12px;
    transition: transform 200ms ease;
  }

  .clear-btn:hover {
    background-color: rgba(248, 113, 113, 0.15);
    color: #f87171;
  }

  .clear-btn:hover svg {
    transform: rotate(90deg);
  }

  .clear-btn:active {
    transform: scale(0.85);
  }

  @keyframes pop-in {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
