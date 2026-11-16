import { useId } from "react";
import { interviewSettings } from "@/config/interview-scenes";
import type { StrandId } from "@/config/strands";

/** A small, local illustration: no third-party image requests or video payload. */
export function InterviewRoom({
  strand = "technology",
  className = "",
}: {
  strand?: StrandId;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const accent = interviewSettings[strand].accent;
  const screen = strand === "technology" || strand === "digital-media";
  const plans =
    strand === "engineering" ||
    strand === "construction" ||
    strand === "aviation";
  return (
    <svg
      className={`interview-room ${className}`}
      viewBox="0 0 960 720"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-wall`}
          x1="110"
          y1="0"
          x2="800"
          y2="620"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#344e60" />
          <stop offset="1" stopColor="#122b3b" />
        </linearGradient>
        <linearGradient
          id={`${id}-floor`}
          x1="480"
          y1="320"
          x2="480"
          y2="720"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8a938d" />
          <stop offset="1" stopColor="#354a50" />
        </linearGradient>
        <linearGradient
          id={`${id}-window`}
          x1="270"
          y1="70"
          x2="270"
          y2="470"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={accent} />
          <stop offset="1" stopColor="#e9deba" />
        </linearGradient>
        <linearGradient
          id={`${id}-desk`}
          x1="480"
          y1="390"
          x2="480"
          y2="530"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#cdbd9c" />
          <stop offset="1" stopColor="#8b806b" />
        </linearGradient>
        <linearGradient
          id={`${id}-chair`}
          x1="400"
          y1="500"
          x2="400"
          y2="650"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#d3b989" />
          <stop offset="1" stopColor="#8e794f" />
        </linearGradient>
        <radialGradient
          id={`${id}-glow`}
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(300 260) rotate(40) scale(600 550)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={accent} stopOpacity=".18" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <filter
          id={`${id}-shadow`}
          x="-40%"
          y="-80%"
          width="180%"
          height="260%"
        >
          <feGaussianBlur stdDeviation="19" />
        </filter>
        <clipPath id={`${id}-arch`}>
          <path d="M120 350V195a142 142 0 0 1 284 0v155Z" />
        </clipPath>
      </defs>
      <path fill={`url(#${id}-wall)`} d="M0 0h960v720H0z" />
      <path fill="#192f3d" d="m700 0 260 0v720L700 430Z" />
      <path fill={`url(#${id}-floor)`} d="m0 450 700-20 260 290H0Z" />
      <path
        d="m700 0 0 430M0 450l700-20M700 430l260 290"
        stroke="#c5d7d8"
        strokeOpacity=".14"
      />
      {[0, 1, 2, 3, 4].map((n) => (
        <path
          key={n}
          d={`M${50 + n * 150} 720 700 430`}
          stroke="#102a38"
          strokeOpacity=".18"
        />
      ))}
      <path d="M106 355V194a156 156 0 0 1 312 0v161Z" fill="#102b3c" />
      <path
        d="M120 350V195a142 142 0 0 1 284 0v155Z"
        fill={`url(#${id}-window)`}
      />
      <g clipPath={`url(#${id}-arch)`} opacity=".3" fill="#798e8a">
        <path d="M100 295h70v90h-70zM175 250h45v135h-45zM228 275h78v110h-78zM316 220h34v165h-34zM361 270h60v115h-60z" />
        <circle cx="341" cy="140" r="41" fill="#fff7df" opacity=".7" />
      </g>
      <path d="M262 54v296M120 250h284" stroke="#183444" strokeWidth="7" />
      <path d="m120 350 284 0 329 260-302 37Z" fill={accent} opacity=".08" />
      <path fill={`url(#${id}-glow)`} d="M0 0h960v720H0z" />
      <g transform="translate(487 117)">
        <rect
          width="153"
          height="144"
          rx="3"
          fill="#0e2432"
          stroke="#829593"
          strokeOpacity=".6"
          strokeWidth="3"
        />
        <rect
          x="10"
          y="10"
          width="133"
          height="124"
          rx="1"
          fill={screen ? "#243f50" : "#d3d2bc"}
        />
        {screen ? (
          <>
            <rect x="25" y="29" width="42" height="5" rx="2" fill={accent} />
            <rect x="25" y="46" width="78" height="4" rx="2" fill="#8ba9b9" />
            <rect x="37" y="58" width="67" height="4" rx="2" fill="#8ba9b9" />
            <rect x="37" y="70" width="50" height="4" rx="2" fill={accent} />
            <rect x="25" y="82" width="90" height="4" rx="2" fill="#8ba9b9" />
            <rect
              x="25"
              y="104"
              width="52"
              height="7"
              rx="3"
              fill={accent}
              opacity=".6"
            />
          </>
        ) : plans ? (
          <g stroke="#627c80" strokeWidth="1.5">
            <path d="m30 80 43-35 43 35-43 34Z M30 80v-24l43-35 43 35v24M73 45V21M73 114V90M30 56l43 34 43-34M28 122h94" />
            <path d="M30 32h22M101 103h23" stroke={accent} strokeWidth="3" />
          </g>
        ) : (
          <>
            <circle cx="75" cy="62" r="28" fill="#8fa197" />
            <path d="m40 108 35-45 36 45Z" fill="#a4b0a0" />
            <circle cx="111" cy="36" r="10" fill="#e2bd78" />
          </>
        )}
      </g>
      <path
        d="M748 89v166M775 71v178M802 59v182M829 43v191M856 26v201M883 12v207M910 0v212"
        stroke="#70818a"
        strokeOpacity=".18"
        strokeWidth="8"
      />
      <ellipse
        cx="475"
        cy="599"
        rx="219"
        ry="47"
        fill="#0a1f2c"
        opacity=".5"
        filter={`url(#${id}-shadow)`}
      />
      <g>
        <path
          d="M480 365h67c21 0 39 17 39 39v68H441v-68c0-22 17-39 39-39Z"
          fill="#294554"
          stroke="#657b83"
          strokeWidth="2"
        />
        <path d="M458 467v78M570 467v78" stroke="#142c3b" strokeWidth="8" />
        <ellipse cx="513" cy="468" rx="73" ry="19" fill="#385969" />
      </g>
      <path
        d="m454 464-22 133h18l26-124M550 464l23 133h-18l-26-124"
        fill="#524f45"
      />
      <ellipse cx="492" cy="447" rx="185" ry="58" fill="#766f60" />
      <ellipse cx="492" cy="438" rx="185" ry="58" fill={`url(#${id}-desk)`} />
      <ellipse
        cx="492"
        cy="437"
        rx="176"
        ry="51"
        stroke="#edddbd"
        strokeOpacity=".25"
      />
      <path d="m491 411 60 9-31 19-59-10Z" fill="#e4e0cd" />
      <path d="m486 417 41 5M480 422l31 5" stroke="#8e988e" strokeWidth="2" />
      <path
        d="m561 438 27-16"
        stroke="#233e4c"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="409" cy="416" rx="15" ry="7" fill="#e9e0c8" />
      <path d="M394 414v-18h30v18c0 9-30 9-30 0Z" fill="#c4c7b9" />
      <ellipse cx="409" cy="396" rx="15" ry="5" fill="#364c52" />
      <path d="M423 398c19-1 17 14 0 12" stroke="#c4c7b9" strokeWidth="4" />
      <g className="room-guest-chair">
        <path
          d="M319 502v-14c0-25 21-45 46-45h45c25 0 45 20 45 45v53H319Z"
          fill={`url(#${id}-chair)`}
          stroke="#e7cb97"
          strokeOpacity=".4"
          strokeWidth="2"
        />
        <path d="M330 551v71M441 551v71" stroke="#18313e" strokeWidth="8" />
        <path
          d="M319 526c0 24 136 24 136 0v19c0 25-136 25-136 0Z"
          fill="#9b855f"
        />
        <ellipse cx="387" cy="526" rx="68" ry="18" fill="#cdb38a" />
        <path d="M333 492v26M441 492v26" stroke="#a18b65" strokeWidth="3" />
      </g>
      <g>
        <path
          d="M154 443v-110M154 387c-45-3-48-37-44-53 30 3 44 19 44 53ZM154 367c41-3 46-32 41-47-28 4-41 21-41 47ZM154 406c40-3 50-27 43-42-30 2-43 20-43 42Z"
          stroke="#597970"
          strokeWidth="3"
          fill="#4b7264"
        />
        <path d="M128 429h52l-7 56h-38Z" fill="#acaa91" />
        <ellipse cx="154" cy="429" rx="26" ry="7" fill="#60715e" />
      </g>
      <path d="M0 670c252-38 490-23 960 50H0Z" fill="#102735" opacity=".15" />
    </svg>
  );
}
