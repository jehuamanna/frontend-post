import '@src/NewTab.css';
import '@src/NewTab.scss';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';

const NewTab = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const logo = isLight ? 'new-tab/logo_horizontal.svg' : 'new-tab/logo_horizontal_dark.svg';

  const goGithubSite = () => chrome.tabs.create(PROJECT_URL_OBJECT);

  console.log(t('hello', 'World'));
  return (
    <div className={cn('App', isLight ? 'bg-white' : 'bg-gray-900', 'flex items-center justify-center min-h-screen')}>
      <h1 className={cn('text-4xl font-semibold text-center', isLight ? 'text-gray-800' : 'text-gray-100')}>
        Welcome! Your Frontend Post extension is activley running.
      </h1>
    </div>
  );
};

export default withErrorBoundary(withSuspense(NewTab, <LoadingSpinner />), ErrorDisplay);
