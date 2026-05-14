// Global error handlers to prevent app crashes
if (typeof window !== 'undefined') {
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Global] Unhandled Promise Rejection:', event.reason);
    // Prevent the default error alert
    event.preventDefault();
    // Could send to error tracking service here
  });

  // Catch global errors
  window.addEventListener('error', (event) => {
    console.error('[Global] Error:', event.error || event.message);
  });

  // Handle Facebook/analytics errors that could bubble up
  window.addEventListener('fbError', (event) => {
    console.warn('[Global] FB Error:', event);
  });
}
