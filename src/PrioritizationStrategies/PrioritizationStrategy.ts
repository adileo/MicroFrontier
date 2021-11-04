abstract class PrioritizationStrategy{
    constructor(public name: string) {}
    abstract getItemPriority(): string
}