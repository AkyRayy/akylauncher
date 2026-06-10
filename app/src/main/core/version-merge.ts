import type { VersionJson } from './mojang-schemas';

export function mergeVersionJson(parent: VersionJson, child: VersionJson): VersionJson {
  return {
    ...parent,
    ...child,
    downloads: child.downloads ?? parent.downloads,
    assetIndex: child.assetIndex ?? parent.assetIndex,
    assets: child.assets ?? parent.assets,
    javaVersion: child.javaVersion ?? parent.javaVersion,
    minecraftArguments: child.minecraftArguments ?? parent.minecraftArguments,
    libraries: [...child.libraries, ...parent.libraries],
    arguments:
      parent.arguments || child.arguments
        ? {
            game: [...(parent.arguments?.game ?? []), ...(child.arguments?.game ?? [])],
            jvm: [...(parent.arguments?.jvm ?? []), ...(child.arguments?.jvm ?? [])]
          }
        : undefined,
    inheritsFrom: undefined
  };
}
