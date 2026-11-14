import { useEffect, useRef, useState } from 'react';
import { Heart, Moon } from 'lucide-react';

type Mood = 'welcome' | 'waiting' | 'comfort' | 'celebrate';
const phrases = [
  '喵～每一次尝试，都在进步呀！',
  '慢慢想，不着急，小橘陪着你。',
  '看看老师的小提示，我们一起再试一次！',
  '你认真思考的样子，闪闪发光！',
];

export default function CatBuddy({
  mood = 'welcome',
  interactive = false,
  decorative = false,
}: {
  mood?: Mood;
  interactive?: boolean;
  decorative?: boolean;
}) {
  const [pets, setPets] = useState(0),
    [waving, setWaving] = useState(false),
    [resting, setResting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function pet() {
    setPets((n) => n + 1);
    setResting(false);
    setWaving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setWaving(false), 1400);
  }
  return (
    <div
      className={`cat-buddy cat-${mood} ${waving ? 'cat-waving' : ''} ${resting ? 'cat-resting' : ''}`}
      aria-hidden={decorative || undefined}
    >
      <div className="cat-picture">
        <span className="cat-heart cat-heart-one" aria-hidden="true">
          ♥
        </span>
        <span className="cat-heart cat-heart-two" aria-hidden="true">
          ✦
        </span>
        <svg
          viewBox="0 0 260 240"
          role={decorative ? undefined : 'img'}
          aria-label={decorative ? undefined : '陪你学习的小橘猫'}
        >
          <ellipse cx="131" cy="218" rx="75" ry="10" fill="#e9d9be" opacity=".48" />
          <g className="cat-tail">
            <path
              d="M179 188 C222 203 233 172 219 155 C209 143 206 161 215 167 C225 178 207 186 190 178"
              fill="#f1b963"
              stroke="#956549"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M218 155 C209 143 206 161 215 167"
              fill="none"
              stroke="#fff0d2"
              strokeWidth="10"
              strokeLinecap="round"
            />
          </g>
          <g className="cat-body">
            <path
              d="M83 152 C74 172 77 199 90 212 L174 212 C188 197 187 171 178 153Z"
              fill="#efba70"
              stroke="#956549"
              strokeWidth="3.5"
            />
            <ellipse cx="133" cy="187" rx="32" ry="27" fill="#fff1d9" />
            <path
              d="M91 179 L88 193 M176 178 L180 191"
              fill="none"
              stroke="#d8994d"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <ellipse
              cx="103"
              cy="212"
              rx="23"
              ry="10"
              fill="#fff1d9"
              stroke="#956549"
              strokeWidth="3"
            />
            <ellipse
              cx="163"
              cy="212"
              rx="23"
              ry="10"
              fill="#fff1d9"
              stroke="#956549"
              strokeWidth="3"
            />
            <path
              d="M99 213v5m8-5v5m52-5v5m8-5v5"
              stroke="#dcbf9a"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <g className="cat-head">
              <path
                d="M66 81 L60 30 Q60 20 70 25 L106 49 M156 49 L192 25 Q201 21 199 33 L194 82"
                fill="#efba70"
                stroke="#956549"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <path d="M72 58 L69 36 L90 53 M171 53 L190 36 L188 61" fill="#f2a799" />
              <path
                d="M65 72 Q82 45 128 46 Q180 43 196 76 Q210 107 194 133 Q178 158 130 158 Q80 158 65 134 Q48 108 65 72Z"
                fill="#f8cb85"
                stroke="#956549"
                strokeWidth="3.5"
              />
              <path
                d="M114 49l5 15m14-17v15m14-12-5 14"
                stroke="#dba05b"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <ellipse cx="131" cy="123" rx="48" ry="29" fill="#fff2dc" />
              <ellipse cx="83" cy="118" rx="14" ry="8" fill="#efa798" opacity=".7" />
              <ellipse cx="180" cy="118" rx="14" ry="8" fill="#efa798" opacity=".7" />
              <g className="cat-eyes">
                {mood === 'celebrate' || mood === 'comfort' ? (
                  <path
                    d="M91 99q9-14 18 0m43 0q9-14 18 0"
                    fill="none"
                    stroke="#6e4b37"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                ) : (
                  <>
                    <ellipse cx="102" cy="99" rx="5" ry="7" fill="#6e4b37" />
                    <ellipse cx="161" cy="99" rx="5" ry="7" fill="#6e4b37" />
                    <circle cx="103" cy="96" r="1.5" fill="#fff9eb" />
                    <circle cx="162" cy="96" r="1.5" fill="#fff9eb" />
                  </>
                )}
              </g>
              <path d="M124 115Q131 110 138 115L132 121Z" fill="#d5887e" />
              <path
                d="M131 121v5m0-1q-9 10-15 1m15-1q8 10 14 0"
                fill="none"
                stroke="#956549"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M60 112l-20-5m22 15-23 3m160-13 20-5m-22 15 23 3"
                stroke="#956549"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
            <path
              d="M88 151Q130 166 177 151L174 166Q129 179 89 166Z"
              fill="#64a99b"
              stroke="#49897c"
              strokeWidth="2"
            />
            <path d="M146 165l20 5-7 21-19-11Z" fill="#79baaa" stroke="#49897c" strokeWidth="2" />
            <circle cx="130" cy="165" r="5" fill="#ffdf8b" />
            <g className="cat-paw">
              <path
                d="M88 171Q65 181 64 162Q63 148 75 148Q84 147 91 163"
                fill="#fff1d9"
                stroke="#956549"
                strokeWidth="3"
              />
              <ellipse cx="74" cy="159" rx="6" ry="5" fill="#efa798" />
              <circle cx="69" cy="150" r="2.5" fill="#efa798" />
              <circle cx="77" cy="149" r="2.5" fill="#efa798" />
            </g>
          </g>
        </svg>
      </div>
      {interactive && (
        <div className="cat-interaction">
          <p className="cat-speech" aria-live="polite">
            {resting
              ? '呼噜～休息一小会儿，再陪你出发。'
              : pets
                ? phrases[(pets - 1) % phrases.length]
                : mood === 'comfort'
                  ? '抱抱你！没关系，我们一起再试一次。'
                  : '我是小橘，你的数学探险伙伴！'}
          </p>
          <div className="cat-buttons">
            <button type="button" className="cat-pet-button" onClick={pet}>
              <Heart size={15} />
              摸摸小橘
            </button>
            <button
              type="button"
              className="cat-rest-button"
              aria-label={resting ? '叫醒小橘' : '让小橘休息'}
              onClick={() => setResting((v) => !v)}
            >
              <Moon size={15} />
              {resting ? '叫醒小橘' : '休息一下'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
