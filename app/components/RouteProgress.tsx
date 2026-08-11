import { useEffect, useState } from "react";
import { useNavigation } from "react-router";

/**
 * A thin progress bar across the top whenever a navigation is in flight.
 *
 * Without it, tapping a link did nothing visible until the next route's code
 * and data had arrived — on a slow connection that was over a second of the
 * old page just sitting there, which reads as a dead button and gets tapped
 * again. This is the acknowledgement.
 *
 * It waits 120ms before showing: navigations that resolve quickly (anything
 * prefetched) shouldn't flash a loading bar for no reason.
 */
export default function RouteProgress() {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(t);
  }, [busy]);

  return (
    <div
      aria-hidden={!visible}
      className="fixed top-0 left-0 right-0 z-[200] h-[3px] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 150ms ease" }}
    >
      <div
        className="h-full bg-[#F4511E]"
        style={{
          width: visible ? "90%" : "0%",
          // Eases toward the end without ever arriving — honest about the fact
          // that we don't know how long it will take.
          transition: visible ? "width 1.8s cubic-bezier(0.1, 0.7, 0.2, 1)" : "none",
          boxShadow: "0 0 10px rgba(244,81,30,0.7)",
        }}
      />
    </div>
  );
}
