import { fetchAllSoftware, type ParsedSoftware } from "./catalogo_api.ts";
import { getLogger } from "./logger.ts";

export interface CatalogoDataSource {
  getAllSoftware(): Promise<readonly ParsedSoftware[]>;
}

type CatalogoLoader = () => Promise<ParsedSoftware[]>;

/** Loads the software catalog once and shares it across all consumers. */
export class CachedCatalogoDataSource implements CatalogoDataSource {
  private readonly log = getLogger("catalogo");
  private itemsPromise?: Promise<readonly ParsedSoftware[]>;

  constructor(private readonly loader: CatalogoLoader = fetchAllSoftware) {}

  getAllSoftware(): Promise<readonly ParsedSoftware[]> {
    this.itemsPromise ??= this.load();
    return this.itemsPromise;
  }

  private async load(): Promise<readonly ParsedSoftware[]> {
    this.log.info("Fetching software catalog...");
    try {
      return await this.loader();
    } catch (error) {
      // A transient failure must not poison the shared data source forever.
      this.itemsPromise = undefined;
      throw error;
    }
  }
}
