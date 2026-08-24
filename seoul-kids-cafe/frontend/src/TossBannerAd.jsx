import {useEffect, useRef, useState} from "react";
import {TossAds} from "@apps-in-toss/web-framework";

const TEST_BANNER_AD_GROUP_ID = "ait-ad-test-banner-id";
const LIVE_BANNER_AD_GROUP_ID = "ait.v2.live.0318df39340142e2";
const BANNER_AD_GROUP_ID = import.meta.env.DEV
  ? TEST_BANNER_AD_GROUP_ID
  : LIVE_BANNER_AD_GROUP_ID;

export default function TossBannerAd() {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const isSupported = Boolean(BANNER_AD_GROUP_ID)
    && TossAds.initialize.isSupported()
    && TossAds.attachBanner.isSupported();

  useEffect(() => {
    if (!isSupported) return undefined;

    let attachedBanner;
    let isDestroyed = false;

    TossAds.initialize({
      callbacks: {
        onInitialized: () => {
          if (isDestroyed || !containerRef.current) return;

          attachedBanner = TossAds.attachBanner(
            BANNER_AD_GROUP_ID,
            containerRef.current,
            {
              theme: "light",
              tone: "blackAndWhite",
              variant: "expanded",
              callbacks: {
                onAdRendered: () => setIsVisible(true),
                onNoFill: () => setIsVisible(false),
                onAdFailedToRender: () => setIsVisible(false)
              }
            }
          );
        },
        onInitializationFailed: () => setIsVisible(false)
      }
    });

    return () => {
      isDestroyed = true;
      attachedBanner?.destroy();
    };
  }, [isSupported]);

  if (!isSupported) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className={`kids-cafe-toss-banner-spacer${isVisible ? " kids-cafe-toss-banner-spacer--visible" : ""}`}
      />
      <aside
        aria-label="광고"
        className={`kids-cafe-toss-banner${isVisible ? " kids-cafe-toss-banner--visible" : ""}`}
      >
        <div ref={containerRef} className="kids-cafe-toss-banner__slot" />
      </aside>
    </>
  );
}
