/**
 * Simple Vite "pseudo-endpoint": import and use in a dev route or expose through your
 * backend if you have one. Example usage in React:
 *   const [h, setH] = useState<HealthResult | null>(null);
 *   useEffect(() => { getHealth().then(setH); }, []);
 */
export { getHealth } from './health';
