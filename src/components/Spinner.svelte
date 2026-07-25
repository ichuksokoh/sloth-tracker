<script lang="ts">
  interface SpinnerProps {
    size?: number;
    color1?: string;
    color2?: string;
    active: boolean;
    timing: number;
  }

  let {
    size = 24,
    color1 = "#1e293b",
    color2 = "#321553",
    active = $bindable(false),
    timing = 1.5
  }: SpinnerProps = $props();
</script>

<div class="spinner-container">
  <div class="spinner"></div>
</div>

<style>
  .spinner-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 45px;
    background: transparent;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 4px solid #1e293b;
    border-top-color: #321553;
    animation: spin 1.5s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
