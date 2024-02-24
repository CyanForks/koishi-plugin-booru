import { Context, Session } from "koishi"
import { Config, OutputType, SpoilerType } from "."

export const inject = {
  required: ['booru'],
  optional: ['assets'],
}

export function apply(ctx: Context, config: Config) {

  const count = (value: string, session: Session) => {
    const count = parseInt(value)
    if (count < 1 || count > config.maxCount) {
      session.send('booru.count-invalid')
      return 1
    }
    return count
  }

  ctx
    .command('booru <query:text>')
    .option('count', '-c <count:number>', { type: count, fallback: 1 })
    .option('label', '-l <label:string>')
    .action(async ({ session, options }, query) => {
      if (!ctx.booru.hasSource(options.label)) return session.text('.no-source')

      query = query?.trim() ?? ''

      const images = await ctx.booru.get({
        query,
        count: options.count,
        labels: options.label?.split(',')?.map((x) => x.trim())?.filter(Boolean) ?? [],
      })
      const source = images?.source

      const filtered = images?.filter((image) => config.nsfw || !image.nsfw)

      if (!filtered?.length) return session?.text('.no-result')

      const output: Element[] = []

      for (const image of filtered) {
        if (config.asset && ctx.assets) {
          image.url = await ctx.booru.imgUrlToAssetUrl(image)
          if (!image.url) {
            output.unshift(<i18n path=".no-image"></i18n>)
            continue
          }
        }
        if (config.base64) {
          image.url = await ctx.booru.imgUrlToBase64(image)
          if (!image.url) {
            output.unshift(<i18n path=".no-image"></i18n>)
            continue
          }
        }
        switch (config.output) {
          case OutputType.All:
            if (image.tags)
              output.unshift(<message>
                <p><i18n path='.output.source'>{[source]}</i18n></p>
                <p><i18n path='.output.tags'>{[image.tags.join(', ')]}</i18n></p>
              </message>)
          case OutputType.ImageAndLink:
            if (image.pageUrl || image.authorUrl)
              output.unshift(<message>
                <p><i18n path='.output.link'>{[image.pageUrl]}</i18n></p>
                <p><i18n path='.output.homepage'>{[image.authorUrl]}</i18n></p>
              </message>)
          case OutputType.ImageAndInfo:
            if (image.title && image.author && image.desc)
              output.unshift(<message>
                <p>{image.title}</p>
                <p><i18n path='.output.author'>{[image.author]}</i18n></p>
                <p><i18n path='.output.desc'>{[image.desc]}</i18n></p>
              </message>)
          case OutputType.ImageOnly:
            output.unshift(
              /**
               * @TODO waiting for upstream to support spoiler tag
               * but is only is attribute, so it's can work now.
               */
              <message>
                <image spoiler={(() => {
                  switch (config.spoiler) {
                    case SpoilerType.Disabled:
                      return false
                    case SpoilerType.All:
                      return true
                    case SpoilerType.OnlyNSFW:
                      return Boolean(image.nsfw)
                  }
                })()} url={image.url}></image></message>
            )
        }
      }
      // the qq platform will can merge the all forward message with one element(forward message block).
      // so can treat it as a spoiler message.
      if (['qq', 'red', 'onebot'].includes(session.platform) && config.spoiler !== SpoilerType.Disabled)
        return <message forward>{output}</message>
      else
        return output.length === 1 ? output[0] : <message forward>{output}</message>
    })
}