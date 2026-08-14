<script lang="ts">
  interface CheckBoxProps {
    checked?: boolean;
    label?: string;
  }
  let { checked = $bindable(false), label = "Checkbox" }: CheckBoxProps = $props();
</script>

<label class="checkbox">
  <input type="checkbox" bind:checked />
  <span class="checkmark">
    {#if checked}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    {/if}
  </span>

  <span class="label">{label}</span>
</label>

<style>
  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }

  .checkbox input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .checkmark {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;

    border: 1.5px solid #475569;
    border-radius: 5px;
    background: #1e293b;

    color: white;

    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      transform 150ms ease;
  }

  .checkbox input:checked + .checkmark {
    background: #6366f1;
    border-color: #818cf8;
  }

  .checkbox input:active + .checkmark {
    transform: scale(0.9);
  }

  .checkmark svg {
    width: 12px;
    height: 12px;
  }

  .label {
    font-size: 13px;
    color: #cbd5e1;
  }
</style>
