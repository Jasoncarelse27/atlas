import whyDidYouRender from "@welldone-software/why-did-you-render";
import React from "react";

if (process.env.NODE_ENV === "development" && typeof whyDidYouRender === "function") {
  whyDidYouRender(React, { trackAllPureComponents: true });
}
