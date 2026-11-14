import { useCallback, useEffect, useState } from 'react';
import { Clock3, Sparkles } from 'lucide-react';
import type { PublicSubmission } from '../../shared/model';
import { useStudent } from '../student-context';
import CatBuddy from './CatBuddy';
import RedPacketRain from './RedPacketRain';

const seenInMemory = new Set<string>();

export default function ReviewMoment({
  submission: s,
  compact = false,
}: {
  submission: PublicSubmission;
  compact?: boolean;
}) {
  const { student } = useStudent();
  const [rain, setRain] = useState(0);
  const closeRain = useCallback(() => setRain(0), []);
  const approved = s.reviewStatus === 'approved',
    returned = s.reviewStatus === 'returned';
  const celebrationKey = `zhike-rain:${student.id}:${s.receipt}:${s.reviewedAt || 'approved'}`;
  useEffect(() => {
    if (!approved || !s.isLatest) {
      setRain(0);
      return;
    }
    let seen = seenInMemory.has(celebrationKey);
    try {
      seen ||= sessionStorage.getItem(celebrationKey) === 'seen';
    } catch {
      /* In-memory tracking still prevents repeated polling effects. */
    }
    if (!seen) {
      seenInMemory.add(celebrationKey);
      try {
        sessionStorage.setItem(celebrationKey, 'seen');
      } catch {
        /* Storage is optional. */
      }
      setRain(1);
    }
  }, [approved, s.isLatest, celebrationKey]);
  const Heading = compact ? 'h3' : 'h1';
  return (
    <div
      className={`review-moment ${compact ? 'review-compact' : 'review-hero'} ${approved ? 'moment-approved' : returned ? 'moment-returned' : 'moment-pending'}`}
    >
      {s.isLatest && (
        <CatBuddy
          mood={approved ? 'celebrate' : returned ? 'comfort' : 'waiting'}
          interactive={returned}
        />
      )}
      <div className="review-message">
        <span className="review-kicker">
          {!s.isLatest ? (
            '我的思考记录'
          ) : approved ? (
            <>
              <Sparkles size={15} />
              数学小达人，真棒！
            </>
          ) : returned ? (
            '小橘给你一个鼓励的抱抱'
          ) : (
            <>
              <Clock3 size={15} />
              老师正在认真看你的想法
            </>
          )}
        </span>
        <Heading>
          {!s.isLatest
            ? '这是一份历史提交'
            : approved
              ? '恭喜你答对了！'
              : returned
                ? '没关系，我们再试一次！'
                : '提交成功，等待老师审核'}
        </Heading>
        <p>
          {!s.isLatest
            ? '你已经有更新的提交，去看看最新的审核状态吧。'
            : approved
              ? '老师已审核通过。你的认真思考，值得一场大大的庆祝！'
              : returned
                ? '一次尝试就有一次收获。看看老师的建议，小橘陪你慢慢想。'
                : '答案已经收到啦！先休息一下，老师看完会告诉你。'}
        </p>
        {approved && s.isLatest && (
          <button type="button" className="celebrate-again" onClick={() => setRain((n) => n + 1)}>
            <Sparkles size={16} />
            再看一次红包雨
          </button>
        )}
      </div>
      {rain > 0 && s.isLatest && approved && <RedPacketRain key={rain} onClose={closeRain} />}
    </div>
  );
}
