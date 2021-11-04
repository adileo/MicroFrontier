class BFSPrioritizationStrategy extends PrioritizationStrategy{
    getItemPriority(): string {
        throw new Error("Method not implemented.");
        // TODO: Check if hostname already visited if so deprioritize or drop URL
    }
}