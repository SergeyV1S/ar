import { Link } from "react-router";

import { Icon } from "@/shared/components/index.ts";
import { PATHS } from "@/shared/constants/index.ts";

export const Brand = ({ link = true }: { link?: boolean }) => {
  const wordmark = (
    <>
      <span className='brand-mark'>
        <Icon name='brand' size={23} />
      </span>
      <span>
        метрика<span className='text-purple'>.</span>
      </span>
    </>
  );
  return link ? (
    <Link to={PATHS.planner} className='brand' aria-label='Метрика, план'>
      {wordmark}
    </Link>
  ) : (
    <span className='brand'>{wordmark}</span>
  );
};
