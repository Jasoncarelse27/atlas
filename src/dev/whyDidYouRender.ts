if (process.env.NODE_ENV === "development") {
  import("why-did-you-render").then(({ default: wdyr }) => {
    import("react").then((React) => {
      wdyr(React, { trackAllPureComponents: true });
    });
  }).catch(() => {
    // Silently fail if why-did-you-render is not available
  });
}
