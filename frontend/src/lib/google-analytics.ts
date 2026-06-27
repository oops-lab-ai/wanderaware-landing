import outputs from "../../../shared/amplify_outputs.json";

interface AmplifyWebOutputs {
  custom?: {
    buildEnv?: string;
  };
}

const googleAnalyticsId = "G-01QRXQJHBF";
const buildEnv = (outputs as AmplifyWebOutputs).custom?.buildEnv;

export function getGoogleAnalyticsHeadMarkup(): string {
  if (!import.meta.env.PROD || buildEnv !== "prod") {
    return "";
  }

  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAnalyticsId}');
</script>`;
}
